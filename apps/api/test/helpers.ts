import { newId } from '@dairy/core';
import { createDb, schema as s } from '@dairy/db';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { buildApp } from '../src/app';
import { loadConfig } from '../src/config';
import { createGoogleVerifier } from '../src/services/google';
import { createMemoryKv } from '../src/services/kv';
import { TokenService } from '../src/services/tokens';
import { createMockProvider, type PaymentProvider } from '../src/services/payments';
import type { Email } from '../src/services/email';

export const CLIENT_ID = 'test-client.apps.googleusercontent.com';

const googleKeys = await generateKeyPair('RS256');
const googleJwk = { ...(await exportJWK(googleKeys.publicKey)), kid: 'test-google', alg: 'RS256' };

/** Sign a token shaped exactly like a Google ID token, with a local test key. */
export async function googleIdToken(claims: { sub: string; email: string; name?: string; nonce?: string; aud?: string; emailVerified?: boolean }) {
  return new SignJWT({ email: claims.email, email_verified: claims.emailVerified ?? true, name: claims.name ?? 'Test User', nonce: claims.nonce })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-google' })
    .setIssuer('https://accounts.google.com')
    .setAudience(claims.aud ?? CLIENT_ID)
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(googleKeys.privateKey);
}

export interface TestApp {
  app: FastifyInstance;
  db: ReturnType<typeof createDb>['db'];
  now: Date;
  payments: PaymentProvider;
  /** Every email the app tried to send. */
  emails: Email[];
  close: () => Promise<void>;
}

export async function createTestApp(now = new Date(), payments: PaymentProvider = createMockProvider()): Promise<TestApp> {
  const config = loadConfig();
  const handle = createDb(config.DATABASE_URL, { max: 5, appName: 'test' });
  const emails: Email[] = [];
  const app = await buildApp(
    {
      config,
      db: handle,
      kv: createMemoryKv(),
      tokens: await TokenService.fromConfig('', config.PUBLIC_API_URL, true),
      google: createGoogleVerifier(CLIENT_ID, createLocalJWKSet({ keys: [googleJwk] })),
      payments,
      email: { name: 'test', send: async (e) => void emails.push(e) },
      now: () => now,
      geocoder: { name: 'test', reverse: async () => ({ area: 'Baner Road, Baner', city: 'Pune', state: 'Maharashtra', pincode: '411045', label: 'Baner Road, Baner, Pune' }) },
    },
    { logger: false },
  );
  await app.ready();
  return {
    app,
    db: handle.db,
    now,
    payments,
    emails,
    close: async () => {
      await app.close();
      await handle.close();
    },
  };
}

export const uniq = () => newId('req').slice(-10).toLowerCase();

/** Sign in as a new (or existing) customer through the real Google flow; returns bearer headers. */
export async function signInAndroid(app: FastifyInstance, sub = `g-${uniq()}`, email = `${sub}@example.com`) {
  const { nonce } = (await app.inject({ method: 'POST', url: '/v1/auth/nonce' })).json();
  const idToken = await googleIdToken({ sub, email, nonce, name: 'Asha Test' });
  const res = await app.inject({ method: 'POST', url: '/v1/auth/google', payload: { idToken, client: 'android', deviceName: 'Test phone' } });
  if (res.statusCode !== 200) throw new Error(`sign-in failed: ${res.body}`);
  const body = res.json();
  return { body, headers: { authorization: `Bearer ${body.accessToken}` }, customerId: body.user.id as string, sub };
}

/** A signed-in customer with a default delivery address. */
export async function readyCustomer(t: TestApp, pincode = '411045') {
  const user = await signInAndroid(t.app);
  const res = await t.app.inject({
    method: 'POST',
    url: '/v1/store/me/addresses',
    headers: user.headers,
    payload: { name: 'Asha Test', phone: '98765 43210', line1: 'B-704, Sai Residency', city: 'Pune', pincode, ...(pincode.startsWith('9') ? { state: 'Army Post' } : {}) },
  });
  if (res.statusCode !== 201) throw new Error(`address failed: ${res.body}`);
  return { ...user, addressId: res.json().id as string };
}

export async function variantIds(t: TestApp) {
  const variants = await t.db.select().from(s.productVariants);
  const bySku = (sku: string) => variants.find((v) => v.sku === sku)!.id;
  return { ghee500: bySku('GH-A2-500'), powder500: bySku('MP-WH-500'), uht1l: bySku('UHT-TM-1L'), milkCake: bySku('SW-MC-250'), peda: bySku('SW-PD-250'), buffalo500: bySku('GH-BF-500') };
}

/** Sign in a staff member with a role through the real Google flow; returns cookie + CSRF headers. */
export async function staffHeaders(t: TestApp, role: string) {
  const email = `${role}-${uniq()}@example.in`;
  await t.db.insert(s.staff).values({ id: newId('stf'), email, name: `${role} user`, role });
  const { nonce } = (await t.app.inject({ method: 'POST', url: '/v1/auth/nonce' })).json();
  const login = await t.app.inject({ method: 'POST', url: '/v1/auth/google', payload: { idToken: await googleIdToken({ sub: `g-${uniq()}`, email, nonce }), client: 'admin' } });
  if (login.statusCode !== 200) throw new Error(`staff login failed: ${login.body}`);
  const c = Object.fromEntries(login.cookies.map((x) => [x.name, x.value]));
  return { cookie: `access_token=${c.access_token}; csrf_token=${c.csrf_token}`, 'x-csrf-token': c.csrf_token! };
}

/** Available units for a variant (on hand − reserved over active batches). */
export async function stockOf(t: TestApp, variantId: string) {
  const rows = await t.db.select().from(s.batches).where(eq(s.batches.variantId, variantId));
  return rows.reduce((n, b) => n + b.onHand - b.reserved, 0);
}
