import { createDb } from '@dairy/db';
import { loadConfig, type Config } from './config';
import type { AppDeps } from './context';
import { createGoogleVerifier } from './services/google';
import { createRedisKv } from './services/kv';
import { TokenService } from './services/tokens';

/** Real dependencies from environment variables. */
export async function createDeps(config: Config = loadConfig(), appName = 'api'): Promise<AppDeps> {
  const db = createDb(config.DATABASE_URL, { max: 10, appName });
  const kv = createRedisKv(config.VALKEY_URL);
  const tokens = await TokenService.fromConfig(config.JWT_PRIVATE_KEYS, config.PUBLIC_API_URL, !config.isProduction);
  const google = createGoogleVerifier(config.GOOGLE_WEB_CLIENT_ID);
  return { config, db, kv, tokens, google, now: () => new Date() };
}
