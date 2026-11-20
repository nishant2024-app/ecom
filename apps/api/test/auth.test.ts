import { newId } from '@dairy/core';
import { schema as s } from '@dairy/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, googleIdToken, signInAndroid, uniq, type TestApp } from './helpers';

let t: TestApp;
beforeAll(async () => {
  t = await createTestApp();
});
afterAll(() => t.close());

const nonce = async () => (await t.app.inject({ method: 'POST', url: '/v1/auth/nonce' })).json().nonce as string;

describe('health and meta', () => {
  it('reports live and ready', async () => {
    expect((await t.app.inject('/v1/health/live')).statusCode).toBe(200);
    expect((await t.app.inject('/v1/health/ready')).json()).toEqual({ status: 'ready' });
  });
  it('serves app config with the Google client ID', async () => {
    const res = await t.app.inject('/v1/app-config');
    expect(res.json().auth.googleClientId).toBe('test-client.apps.googleusercontent.com');
  });
  it('returns problem+json for unknown routes', async () => {
    const res = await t.app.inject('/v1/nope');
    expect(res.statusCode).toBe(404);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.json()).toMatchObject({ code: 'NOT_FOUND', requestId: expect.stringMatching(/^req_/) });
  });
});

describe('Google sign-in', () => {
  it('creates a customer and wallet on first sign-in, reuses it after', async () => {
    const sub = `g-${uniq()}`;
    const first = await signInAndroid(t.app, sub);
    expect(first.body.isNewUser).toBe(true);
    expect(first.body.user).toMatchObject({ type: 'customer', profileComplete: false });
    const again = await signInAndroid(t.app, sub);
    expect(again.body.isNewUser).toBe(false);
    expect(again.customerId).toBe(first.customerId);
    const me = await t.app.inject({ url: '/v1/store/me', headers: again.headers });
    expect(me.json().id).toBe(first.customerId);
  });

  it('rejects reused nonces, wrong audience and unverified emails', async () => {
    const n = await nonce();
    const ok = await googleIdToken({ sub: `g-${uniq()}`, email: 'a@example.com', nonce: n });
    expect((await t.app.inject({ method: 'POST', url: '/v1/auth/google', payload: { idToken: ok, client: 'android' } })).statusCode).toBe(200);
    const replay = await t.app.inject({ method: 'POST', url: '/v1/auth/google', payload: { idToken: ok, client: 'android' } });
    expect(replay.json().code).toBe('AUTH_NONCE_INVALID');

    const wrongAud = await googleIdToken({ sub: 'x', email: 'b@example.com', nonce: await nonce(), aud: 'someone-else' });
    expect((await t.app.inject({ method: 'POST', url: '/v1/auth/google', payload: { idToken: wrongAud, client: 'android' } })).json().code).toBe('AUTH_INVALID_GOOGLE_TOKEN');

    const unverified = await googleIdToken({ sub: 'y', email: 'c@example.com', nonce: await nonce(), emailVerified: false });
    expect((await t.app.inject({ method: 'POST', url: '/v1/auth/google', payload: { idToken: unverified, client: 'android' } })).statusCode).toBe(401);
  });

  it('sets httpOnly cookies for web and enforces CSRF on writes', async () => {
    const idToken = await googleIdToken({ sub: `g-${uniq()}`, email: 'web@example.com', nonce: await nonce() });
    const res = await t.app.inject({ method: 'POST', url: '/v1/auth/google', payload: { idToken, client: 'web' } });
    expect(res.json().accessToken).toBeUndefined();
    const cookies = Object.fromEntries(res.cookies.map((c) => [c.name, c]));
    expect(cookies.access_token!.httpOnly).toBe(true);
    expect(cookies.csrf_token!.httpOnly).toBeFalsy();
    const cookieHeader = `access_token=${cookies.access_token!.value}; csrf_token=${cookies.csrf_token!.value}`;

    expect((await t.app.inject({ url: '/v1/store/me', headers: { cookie: cookieHeader } })).statusCode).toBe(200);
    const noCsrf = await t.app.inject({ method: 'PATCH', url: '/v1/store/me', headers: { cookie: cookieHeader }, payload: { name: 'X' } });
    expect(noCsrf.json().code).toBe('CSRF_FAILED');
    const withCsrf = await t.app.inject({
      method: 'PATCH',
      url: '/v1/store/me',
      headers: { cookie: cookieHeader, 'x-csrf-token': cookies.csrf_token!.value },
      payload: { name: 'Web User' },
    });
    expect(withCsrf.json().name).toBe('Web User');
  });

  it('rotates refresh tokens and revokes the session on reuse', async () => {
    const user = await signInAndroid(t.app);
    const r1 = await t.app.inject({ method: 'POST', url: '/v1/auth/refresh', payload: { refreshToken: user.body.refreshToken } });
    expect(r1.statusCode).toBe(200);
    const rotated = r1.json().refreshToken;
    expect(rotated).not.toBe(user.body.refreshToken);

    // The old token replayed (outside the 30 s grace window) revokes the session.
    t.now.setTime(t.now.getTime() + 60_000);
    const reuse = await t.app.inject({ method: 'POST', url: '/v1/auth/refresh', payload: { refreshToken: user.body.refreshToken } });
    expect(reuse.json().code).toBe('AUTH_REFRESH_REUSED');
    const after = await t.app.inject({ method: 'POST', url: '/v1/auth/refresh', payload: { refreshToken: rotated } });
    expect(after.json().code).toBe('AUTH_REFRESH_INVALID');
    expect((await t.app.inject({ url: '/v1/store/me', headers: { authorization: `Bearer ${r1.json().accessToken}` } })).statusCode).toBe(401);
  });

  it('logs out and lists sessions', async () => {
    const user = await signInAndroid(t.app);
    const list = await t.app.inject({ url: '/v1/auth/sessions', headers: user.headers });
    expect(list.json().data).toHaveLength(1);
    expect(list.json().data[0].current).toBe(true);
    expect((await t.app.inject({ method: 'POST', url: '/v1/auth/logout', headers: user.headers })).statusCode).toBe(204);
    expect((await t.app.inject({ url: '/v1/store/me', headers: user.headers })).statusCode).toBe(401);
  });

  it('lets only invited staff into the admin and enforces permissions', async () => {
    const email = `dispatch-${uniq()}@example.in`;
    const denied = await googleIdToken({ sub: `g-${uniq()}`, email, nonce: await nonce() });
    expect((await t.app.inject({ method: 'POST', url: '/v1/auth/google', payload: { idToken: denied, client: 'admin' } })).json().code).toBe('STAFF_NOT_ALLOWED');

    await t.db.insert(s.staff).values({ id: newId('stf'), email, name: 'Dispatch', role: 'support' });
    const sub = `g-${uniq()}`;
    const idToken = await googleIdToken({ sub, email, nonce: await nonce() });
    const res = await t.app.inject({ method: 'POST', url: '/v1/auth/google', payload: { idToken, client: 'admin' } });
    expect(res.json().user).toMatchObject({ type: 'staff', role: 'support' });
    const cookies = Object.fromEntries(res.cookies.map((c) => [c.name, c.value]));
    const headers = { cookie: `access_token=${cookies.access_token}; csrf_token=${cookies.csrf_token}`, 'x-csrf-token': cookies.csrf_token! };

    const forbidden = await t.app.inject({ url: '/v1/admin/inventory', headers: { ...headers } });
    expect(forbidden.statusCode).toBe(200); // support can read the catalog
    expect((await t.app.inject({ url: '/v1/admin/staff', headers })).json().code).toBe('FORBIDDEN');

    // A customer token can't reach admin routes at all.
    const customer = await signInAndroid(t.app);
    expect((await t.app.inject({ url: '/v1/admin/orders', headers: customer.headers })).statusCode).toBe(403);
  });
});

describe('docs', () => {
  it('serves the interactive API reference without auth outside production', async () => {
    const res = await t.app.inject('/docs');
    expect([200, 301, 302]).toContain(res.statusCode);
    expect((await t.app.inject('/docs/')).statusCode).toBe(200);
    const spec = t.app.swagger() as { paths: Record<string, unknown> };
    expect(Object.keys(spec.paths)).toContain('/v1/store/orders');
  });
});
