import type { FastifyInstance, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import type { AuthContext } from '../context';
import { AppError, forbidden } from '../lib/errors';
import { hasPermission } from '../lib/permissions';

export const COOKIE_ACCESS = 'access_token';
export const COOKIE_REFRESH = 'refresh_token';
export const COOKIE_CSRF = 'csrf_token';

const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const AUDIENCE_FOR = { customer: 'store', staff: 'admin' } as const;

export const revokedKey = (sid: string) => `revoked:sid:${sid}`;

function readToken(req: FastifyRequest): { token: string; via: 'bearer' | 'cookie' } | null {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return { token: header.slice(7).trim(), via: 'bearer' };
  const cookie = req.cookies?.[COOKIE_ACCESS];
  return cookie ? { token: cookie, via: 'cookie' } : null;
}

/** Double-submit CSRF check for cookie-authenticated unsafe requests. */
export function checkCsrf(req: FastifyRequest): void {
  if (!UNSAFE.has(req.method)) return;
  const cookie = req.cookies?.[COOKIE_CSRF];
  const header = req.headers['x-csrf-token'];
  if (!cookie || typeof header !== 'string' || header !== cookie) {
    throw new AppError('CSRF_FAILED', 403, 'Missing or invalid X-CSRF-Token header');
  }
}

export default fp(async function authPlugin(app: FastifyInstance) {
  app.decorateRequest('auth', null);

  app.addHook('preHandler', async (req) => {
    // Routes outside /v1 (docs, 404 handler) are public; /v1 routes require auth unless marked public.
    const url = req.routeOptions.url;
    const mode = !url || !url.startsWith('/v1') ? 'public' : (req.routeOptions.config?.auth ?? 'any');
    const found = readToken(req);

    if (found) {
      const claims = await app.deps.tokens.verifyAccess(found.token).catch((err) => {
        if (mode === 'public') return null; // public routes ignore bad tokens
        throw err;
      });
      if (claims) {
        if (await app.deps.kv.get(revokedKey(claims.sid))) {
          if (mode !== 'public') throw new AppError('AUTH_TOKEN_INVALID', 401, 'Session has ended; sign in again');
        } else {
          req.auth = { ...claims, via: found.via } satisfies AuthContext;
        }
      }
    }

    if (mode === 'public') return;
    if (!req.auth) throw new AppError('AUTH_REQUIRED', 401, 'Sign in to continue');
    if (mode !== 'any') {
      if (req.auth.typ !== mode || req.auth.aud !== AUDIENCE_FOR[mode]) throw forbidden('This endpoint is not available for your account type');
    }
    if (req.auth.via === 'cookie' && req.routeOptions.config?.csrf !== false) checkCsrf(req);
    const permission = req.routeOptions.config?.permission;
    if (permission && !(req.auth.typ === 'staff' && hasPermission(req.auth.role, permission))) {
      throw forbidden(`Requires permission ${permission}`);
    }
  });
});

export function requireAuth(req: FastifyRequest): AuthContext {
  if (!req.auth) throw new AppError('AUTH_REQUIRED', 401, 'Sign in to continue');
  return req.auth;
}
