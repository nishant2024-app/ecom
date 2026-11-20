import { newId } from '@dairy/core';
import { schema as s, type DbOrTx } from '@dairy/db';
import { Type } from '@sinclair/typebox';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { AppError, notFound } from '../lib/errors';
import { ErrorResponses, IdParam, Nullable } from '../lib/schemas';
import { COOKIE_ACCESS, COOKIE_CSRF, COOKIE_REFRESH, checkCsrf, requireAuth, revokedKey } from '../plugins/auth';
import {
  ACCESS_TTL_SECONDS,
  REFRESH_TTL_SECONDS,
  hashToken,
  newOpaque,
  newRefreshToken,
  type Client,
  type UserType,
} from '../services/tokens';

const NONCE_TTL = 300;
const REFRESH_GRACE_MS = 30_000;
const nonceKey = (n: string) => `nonce:${n}`;

const UserSummary = Type.Object({
  type: Type.Union([Type.Literal('customer'), Type.Literal('staff')]),
  id: Type.String(),
  name: Type.String(),
  email: Type.String(),
  phone: Type.Optional(Nullable(Type.String())),
  language: Type.Optional(Type.String()),
  role: Type.Optional(Type.String()),
  profileComplete: Type.Optional(Type.Boolean()),
});

const AuthResult = Type.Object({
  user: UserSummary,
  isNewUser: Type.Optional(Type.Boolean()),
  expiresIn: Type.Integer(),
  accessToken: Type.Optional(Type.String()),
  refreshToken: Type.Optional(Type.String()),
});

type UserSummaryT = typeof UserSummary.static;

const ipPrefix = (ip: string) => (ip.includes(':') ? ip.split(':').slice(0, 4).join(':') : ip.split('.').slice(0, 3).join('.') + '.0');

async function customerSummary(db: DbOrTx, id: string): Promise<UserSummaryT> {
  const [c] = await db.select().from(s.customers).where(eq(s.customers.id, id));
  if (!c) throw notFound('Customer');
  return {
    type: 'customer',
    id: c.id,
    name: c.name,
    email: c.email,
    phone: c.phone,
    language: c.language,
    profileComplete: !!c.defaultAddressId,
  };
}

export default async function authRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<TypeBoxTypeProvider>();
  const { config, kv, tokens, google } = app.deps;
  const { db } = app.deps.db;

  function setCookies(reply: FastifyReply, accessToken: string, refreshToken: string, userType: UserType) {
    const base = {
      httpOnly: true,
      secure: config.secureCookies,
      path: '/',
      ...(config.COOKIE_DOMAIN && config.COOKIE_DOMAIN !== 'localhost' ? { domain: config.COOKIE_DOMAIN } : {}),
    };
    reply.setCookie(COOKIE_ACCESS, accessToken, { ...base, sameSite: 'lax', maxAge: ACCESS_TTL_SECONDS });
    reply.setCookie(COOKIE_REFRESH, refreshToken, { ...base, sameSite: 'strict', maxAge: REFRESH_TTL_SECONDS[userType] });
    reply.setCookie(COOKIE_CSRF, newOpaque(18), { ...base, httpOnly: false, sameSite: 'lax', maxAge: REFRESH_TTL_SECONDS[userType] });
  }

  function clearCookies(reply: FastifyReply) {
    const opts = { path: '/', ...(config.COOKIE_DOMAIN && config.COOKIE_DOMAIN !== 'localhost' ? { domain: config.COOKIE_DOMAIN } : {}) };
    for (const c of [COOKIE_ACCESS, COOKIE_REFRESH, COOKIE_CSRF]) reply.clearCookie(c, opts);
  }

  async function issue(
    req: FastifyRequest,
    reply: FastifyReply,
    user: { type: UserType; id: string; role?: string },
    client: Client,
    deviceName: string | undefined,
  ) {
    const refreshToken = newRefreshToken();
    const sessionId = newId('ses');
    const now = app.deps.now();
    await db.insert(s.sessions).values({
      id: sessionId,
      userType: user.type,
      userId: user.id,
      client,
      refreshTokenHash: hashToken(refreshToken),
      deviceName: deviceName ?? null,
      userAgent: req.headers['user-agent']?.slice(0, 300) ?? null,
      ipPrefix: ipPrefix(req.ip),
      expiresAt: new Date(now.getTime() + REFRESH_TTL_SECONDS[user.type] * 1000),
    });
    const accessToken = await tokens.signAccess({
      sub: user.id,
      sid: sessionId,
      aud: user.type === 'customer' ? 'store' : 'admin',
      typ: user.type,
      role: user.role,
      client,
    });
    if (client === 'android') return { accessToken, refreshToken, expiresIn: ACCESS_TTL_SECONDS };
    setCookies(reply, accessToken, refreshToken, user.type);
    return { expiresIn: ACCESS_TTL_SECONDS };
  }

  app.deps.issueSession = issue;

  app.post(
    '/nonce',
    {
      config: { auth: 'public', rateLimit: { max: 20, timeWindow: '1 minute' } },
      schema: {
        tags: ['Auth'],
        summary: 'Get a single-use nonce for Google sign-in',
        response: { 200: Type.Object({ nonce: Type.String(), expiresAt: Type.String() }) },
      },
    },
    async () => {
      const nonce = `n_${newOpaque(16)}`;
      await kv.set(nonceKey(nonce), '1', NONCE_TTL);
      return { nonce, expiresAt: new Date(app.deps.now().getTime() + NONCE_TTL * 1000).toISOString() };
    },
  );

  app.post(
    '/google',
    {
      config: { auth: 'public', rateLimit: { max: 10, timeWindow: '1 minute' } },
      schema: {
        tags: ['Auth'],
        summary: 'Exchange a Google ID token for a session',
        body: Type.Object({
          idToken: Type.String({ minLength: 20, maxLength: 4096 }),
          client: Type.Union([Type.Literal('web'), Type.Literal('admin'), Type.Literal('android')]),
          deviceName: Type.Optional(Type.String({ maxLength: 80 })),
        }),
        response: { 200: AuthResult, ...ErrorResponses },
      },
    },
    async (req, reply) => {
      const { idToken, client, deviceName } = req.body;
      const identity = await google.verify(idToken);
      if (!identity.nonce || !(await kv.take(nonceKey(identity.nonce)))) {
        throw new AppError('AUTH_NONCE_INVALID', 401, 'Sign-in expired; please try again');
      }

      if (client === 'web' || client === 'android') {
        let isNewUser = false;
        const customerId = await db.transaction(async (tx) => {
          const [existing] = await tx
            .select({ userId: s.authIdentities.userId })
            .from(s.authIdentities)
            .where(and(eq(s.authIdentities.provider, 'google'), eq(s.authIdentities.subject, identity.sub), eq(s.authIdentities.userType, 'customer')));
          if (existing) {
            await tx.update(s.authIdentities).set({ email: identity.email }).where(and(eq(s.authIdentities.provider, 'google'), eq(s.authIdentities.subject, identity.sub)));
            return existing.userId;
          }
          isNewUser = true;
          const id = newId('cus');
          await tx.insert(s.customers).values({ id, name: identity.name, email: identity.email });
          await tx.insert(s.authIdentities).values({ id: newId('idn'), userType: 'customer', userId: id, provider: 'google', subject: identity.sub, email: identity.email });
          return id;
        });
        const [c] = await db.select({ status: s.customers.status }).from(s.customers).where(eq(s.customers.id, customerId));
        if (c?.status === 'deleted') throw new AppError('FORBIDDEN', 403, 'This account was deleted');
        if (c?.status === 'deletion_requested') {
          // Signing in again within the grace period cancels the deletion.
          await db.update(s.customers).set({ status: 'active', deletionRequestedAt: null }).where(eq(s.customers.id, customerId));
        }
        const tokensOut = await issue(req, reply, { type: 'customer', id: customerId }, client, deviceName);
        return { user: await customerSummary(db, customerId), isNewUser, ...tokensOut };
      }

      // Staff: invite-only, bound to one Google account.
      const table = s.staff;
      const userType: UserType = 'staff';
      const [byIdentity] = await db.select().from(table).where(eq(table.googleSub, identity.sub));
      let member = byIdentity;
      if (!member) {
        const [invited] = await db
          .select()
          .from(table)
          .where(and(sql`lower(${table.email}) = ${identity.email}`, isNull(table.googleSub)));
        if (invited) {
          await db.update(table).set({ googleSub: identity.sub }).where(eq(table.id, invited.id));
          member = { ...invited, googleSub: identity.sub };
        }
      }
      const active = member && (member.status === 'active');
      if (!member || !active) throw new AppError('STAFF_NOT_ALLOWED', 403, 'This Google account is not an active team member');
      const role = member.role;
      await db.update(s.staff).set({ lastSignInAt: app.deps.now() }).where(eq(s.staff.id, member.id));
      const tokensOut = await issue(req, reply, { type: userType, id: member.id, role }, client, deviceName);
      return {
        user: { type: userType, id: member.id, name: member.name, email: member.email, ...(role ? { role } : {}) },
        ...tokensOut,
      };
    },
  );

  app.post(
    '/refresh',
    {
      config: { auth: 'public' },
      schema: {
        tags: ['Auth'],
        summary: 'Rotate access and refresh tokens',
        body: Type.Optional(Type.Object({ refreshToken: Type.Optional(Type.String({ maxLength: 200 })) })),
        response: { 200: AuthResult, ...ErrorResponses },
      },
    },
    async (req, reply) => {
      const fromBody = req.body?.refreshToken;
      const presented = fromBody ?? req.cookies[COOKIE_REFRESH];
      if (!presented) throw new AppError('AUTH_REFRESH_INVALID', 401, 'No session; sign in again');
      if (!fromBody) checkCsrf(req);
      const hash = hashToken(presented);
      const now = app.deps.now();

      const [session] = await db.select().from(s.sessions).where(eq(s.sessions.refreshTokenHash, hash));
      if (!session) {
        const [replayed] = await db.select().from(s.sessions).where(eq(s.sessions.previousTokenHash, hash));
        if (replayed && !replayed.revokedAt) {
          if (now.getTime() - replayed.lastUsedAt.getTime() < REFRESH_GRACE_MS) {
            throw new AppError('CONFLICT', 409, 'Session was just refreshed by another request; retry with the new token');
          }
          await db.update(s.sessions).set({ revokedAt: now }).where(eq(s.sessions.id, replayed.id));
          await kv.set(revokedKey(replayed.id), '1', ACCESS_TTL_SECONDS);
          clearCookies(reply);
          throw new AppError('AUTH_REFRESH_REUSED', 401, 'Session revoked for safety; sign in again');
        }
        clearCookies(reply);
        throw new AppError('AUTH_REFRESH_INVALID', 401, 'Session expired; sign in again');
      }
      if (session.revokedAt || session.expiresAt < now) {
        clearCookies(reply);
        throw new AppError('AUTH_REFRESH_INVALID', 401, 'Session expired; sign in again');
      }

      const userType = session.userType as UserType;
      let role: string | undefined;
      let user: UserSummaryT;
      if (userType === 'customer') {
        user = await customerSummary(db, session.userId);
      } else {
        const [m] = await db.select().from(s.staff).where(eq(s.staff.id, session.userId));
        if (!m || m.status !== 'active') {
          await db.update(s.sessions).set({ revokedAt: now }).where(eq(s.sessions.id, session.id));
          throw new AppError('AUTH_REFRESH_INVALID', 401, 'Account is no longer active');
        }
        role = m.role;
        user = { type: userType, id: m.id, name: m.name, email: m.email, ...(role ? { role } : {}) };
      }

      const refreshToken = newRefreshToken();
      const rotated = await db
        .update(s.sessions)
        .set({
          previousTokenHash: hash,
          refreshTokenHash: hashToken(refreshToken),
          lastUsedAt: now,
          expiresAt: new Date(now.getTime() + REFRESH_TTL_SECONDS[userType] * 1000),
        })
        .where(and(eq(s.sessions.id, session.id), eq(s.sessions.refreshTokenHash, hash)))
        .returning({ id: s.sessions.id });
      if (rotated.length === 0) throw new AppError('CONFLICT', 409, 'Session was just refreshed by another request; retry');

      const client = session.client as Client;
      const accessToken = await tokens.signAccess({
        sub: session.userId,
        sid: session.id,
        aud: userType === 'customer' ? 'store' : 'admin',
        typ: userType,
        role,
        client,
      });
      if (fromBody) return { user, accessToken, refreshToken, expiresIn: ACCESS_TTL_SECONDS };
      setCookies(reply, accessToken, refreshToken, userType);
      return { user, expiresIn: ACCESS_TTL_SECONDS };
    },
  );

  app.post(
    '/logout',
    { config: { auth: 'any' }, schema: { tags: ['Auth'], summary: 'End the current session' } },
    async (req, reply) => {
      const auth = requireAuth(req);
      await db.update(s.sessions).set({ revokedAt: app.deps.now() }).where(eq(s.sessions.id, auth.sid));
      await kv.set(revokedKey(auth.sid), '1', ACCESS_TTL_SECONDS);
      clearCookies(reply);
      return reply.status(204).send();
    },
  );

  const SessionOut = Type.Object({
    id: Type.String(),
    client: Type.String(),
    deviceName: Nullable(Type.String()),
    createdAt: Type.String(),
    lastUsedAt: Type.String(),
    current: Type.Boolean(),
  });

  app.get(
    '/sessions',
    { config: { auth: 'any' }, schema: { tags: ['Auth'], summary: 'List my sessions', response: { 200: Type.Object({ data: Type.Array(SessionOut) }) } } },
    async (req) => {
      const auth = requireAuth(req);
      const rows = await db
        .select()
        .from(s.sessions)
        .where(and(eq(s.sessions.userType, auth.typ), eq(s.sessions.userId, auth.sub), isNull(s.sessions.revokedAt), sql`${s.sessions.expiresAt} > now()`))
        .orderBy(desc(s.sessions.lastUsedAt));
      return {
        data: rows.map((r) => ({
          id: r.id,
          client: r.client,
          deviceName: r.deviceName,
          createdAt: r.createdAt.toISOString(),
          lastUsedAt: r.lastUsedAt.toISOString(),
          current: r.id === auth.sid,
        })),
      };
    },
  );

  app.delete(
    '/sessions/:sessionId',
    { config: { auth: 'any' }, schema: { tags: ['Auth'], summary: 'Sign out one device', params: IdParam('sessionId') } },
    async (req, reply) => {
      const auth = requireAuth(req);
      const revoked = await db
        .update(s.sessions)
        .set({ revokedAt: app.deps.now() })
        .where(and(eq(s.sessions.id, req.params.sessionId), eq(s.sessions.userType, auth.typ), eq(s.sessions.userId, auth.sub)))
        .returning({ id: s.sessions.id });
      if (revoked.length === 0) throw notFound('Session');
      await kv.set(revokedKey(req.params.sessionId), '1', ACCESS_TTL_SECONDS);
      return reply.status(204).send();
    },
  );

  app.get(
    '/.well-known/jwks.json',
    { config: { auth: 'public' }, schema: { tags: ['Auth'], summary: 'Public keys for our access tokens' } },
    async () => tokens.jwks(),
  );
}
