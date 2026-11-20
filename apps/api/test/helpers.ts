import { newId, postings } from '@dairy/core';
import { createDb, schema as s } from '@dairy/db';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { buildApp } from '../src/app';
import { loadConfig } from '../src/config';
import { createGoogleVerifier } from '../src/services/google';
import { createMemoryKv } from '../src/services/kv';
import { TokenService } from '../src/services/tokens';
import { postToWallet } from '../src/services/wallet';

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
  close: () => Promise<void>;
}

export async function createTestApp(now = new Date()): Promise<TestApp> {
  const config = loadConfig();
  const handle = createDb(config.DATABASE_URL, { max: 5, appName: 'test' });
  const app = await buildApp(
    {
      config,
      db: handle,
      kv: createMemoryKv(),
      tokens: await TokenService.fromConfig('', config.PUBLIC_API_URL, true),
      google: createGoogleVerifier(CLIENT_ID, createLocalJWKSet({ keys: [googleJwk] })),
      now: () => now,
    },
    { logger: false },
  );
  await app.ready();
  return { app, db: handle.db, now, close: async () => { await app.close(); await handle.close(); } };
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

/** A signed-in customer with a phone, a serviceable address and wallet credit. */
export async function readyCustomer(t: TestApp, walletPaise = 50_000) {
  const user = await signInAndroid(t.app);
  await t.app.inject({ method: 'PATCH', url: '/v1/store/me', headers: user.headers, payload: { phone: '98765 43210' } });
  const address = (
    await t.app.inject({
      method: 'POST',
      url: '/v1/store/me/addresses',
      headers: user.headers,
      payload: { line1: 'B-704, Sai Residency', city: 'Pune', state: 'Maharashtra', pincode: '411045', location: { lat: 18.559, lng: 73.7868 } },
    })
  ).json();
  if (walletPaise > 0) {
    const [wallet] = await t.db.select().from(s.wallets).where(eq(s.wallets.customerId, user.customerId));
    await t.db.transaction((tx) => postToWallet(tx, wallet!.id, postings.topup(walletPaise), { type: 'test', id: newId('top') }, 'Test top-up'));
  }
  return { ...user, addressId: address.id as string };
}

export async function catalogIds(t: TestApp) {
  const variants = await t.db.select().from(s.productVariants);
  const slots = await t.db.select().from(s.deliverySlots);
  const bySku = (sku: string) => variants.find((v) => v.sku === sku)!.id;
  return { slotId: slots[0]!.id, toned500: bySku('TM-500'), curd400: bySku('CU-400'), paneer200: bySku('PN-200') };
}
