import { createDb } from '@dairy/db';
import { loadConfig, type Config } from './config';
import type { AppDeps } from './context';
import { createGoogleVerifier } from './services/google';
import { createCashfreeProvider, createMockProvider, type PaymentProvider } from './services/payments';
import { createRedisKv } from './services/kv';
import { TokenService } from './services/tokens';

/** Real dependencies from environment variables. */
export async function createDeps(config: Config = loadConfig(), appName = 'api'): Promise<AppDeps> {
  const db = createDb(config.DATABASE_URL, { max: 10, appName });
  const kv = createRedisKv(config.VALKEY_URL);
  const tokens = await TokenService.fromConfig(config.JWT_PRIVATE_KEYS, config.PUBLIC_API_URL, !config.isProduction);
  const google = createGoogleVerifier(config.GOOGLE_WEB_CLIENT_ID);
  return { config, db, kv, tokens, google, payments: paymentProvider(config), now: () => new Date() };
}

/** Cashfree when keys are configured; the mock provider only outside production. */
export function paymentProvider(config: Config): PaymentProvider {
  if (config.CASHFREE_APP_ID && config.CASHFREE_SECRET_KEY) {
    return createCashfreeProvider({
      appId: config.CASHFREE_APP_ID,
      secretKey: config.CASHFREE_SECRET_KEY,
      environment: config.CASHFREE_ENV,
      apiVersion: config.CASHFREE_API_VERSION,
    });
  }
  if (config.isProduction) throw new Error('CASHFREE_APP_ID and CASHFREE_SECRET_KEY are required in production');
  return createMockProvider();
}
