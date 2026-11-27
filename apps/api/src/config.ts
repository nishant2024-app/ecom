import { Type, type Static } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';

/** Every environment variable the API reads. Validated at start-up; the process exits on error. */
const ConfigSchema = Type.Object({
  NODE_ENV: Type.Union([Type.Literal('development'), Type.Literal('production'), Type.Literal('test')], {
    default: 'development',
  }),
  APP_ENV: Type.Union([Type.Literal('local'), Type.Literal('staging'), Type.Literal('production'), Type.Literal('test')], {
    default: 'local',
  }),
  API_PORT: Type.Integer({ default: 4000 }),
  LOG_LEVEL: Type.String({ default: 'info' }),
  PUBLIC_WEB_URL: Type.String({ default: 'http://localhost:3000' }),
  PUBLIC_API_URL: Type.String({ default: 'http://localhost:4000' }),
  CORS_ORIGINS: Type.String({ default: 'http://localhost:3000,http://localhost:5173,http://localhost:5174' }),
  COOKIE_DOMAIN: Type.String({ default: 'localhost' }),
  DATABASE_URL: Type.String({ minLength: 1 }),
  VALKEY_URL: Type.String({ default: 'redis://localhost:6379/0' }),
  GOOGLE_WEB_CLIENT_ID: Type.String({ default: '' }),
  JWT_PRIVATE_KEYS: Type.String({ default: '' }),
  AUTH_TEST_MODE: Type.Boolean({ default: false }),
  RATE_LIMIT_ENABLED: Type.Boolean({ default: true }),
  R2_PUBLIC_BASE_URL: Type.String({ default: 'http://localhost:4000/media' }),
  R2_ACCOUNT_ID: Type.String({ default: '' }),
  R2_ACCESS_KEY_ID: Type.String({ default: '' }),
  R2_SECRET_ACCESS_KEY: Type.String({ default: '' }),
  R2_BUCKET_MEDIA: Type.String({ default: '' }),
  MEDIA_DIR: Type.String({ default: './var/media' }),
  /** Reverse geocoding (pin → area/city/pincode). Nominatim-compatible URL, or "off". */
  GEOCODER_URL: Type.String({ default: 'https://nominatim.openstreetmap.org' }),
  /** Contact email sent to the geocoding provider, as its usage policy asks. */
  GEOCODER_EMAIL: Type.String({ default: '' }),
  CASHFREE_ENV: Type.Union([Type.Literal('sandbox'), Type.Literal('production')], { default: 'sandbox' }),
  CASHFREE_APP_ID: Type.String({ default: '' }),
  CASHFREE_SECRET_KEY: Type.String({ default: '' }),
  CASHFREE_API_VERSION: Type.String({ default: '2025-01-01' }),
});

export type Config = Static<typeof ConfigSchema> & {
  corsOrigins: string[];
  isProduction: boolean;
  secureCookies: boolean;
};

export class ConfigError extends Error {}

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const raw: Record<string, unknown> = {};
  for (const key of Object.keys(ConfigSchema.properties)) {
    const v = env[key];
    if (v !== undefined && v !== '') raw[key] = v;
  }
  const converted = Value.Convert(ConfigSchema, Value.Default(ConfigSchema, raw));
  const errors = [...Value.Errors(ConfigSchema, converted)];
  if (errors.length > 0) {
    throw new ConfigError(
      'Invalid configuration:\n' + errors.map((e) => `  ${e.path.slice(1) || '(root)'}: ${e.message}`).join('\n'),
    );
  }
  const c = converted as Static<typeof ConfigSchema>;
  const isProduction = c.APP_ENV === 'production';
  if (isProduction && c.AUTH_TEST_MODE) throw new ConfigError('AUTH_TEST_MODE must not be enabled in production');
  if (isProduction && !c.GOOGLE_WEB_CLIENT_ID) throw new ConfigError('GOOGLE_WEB_CLIENT_ID is required in production');
  if (isProduction && !c.JWT_PRIVATE_KEYS) throw new ConfigError('JWT_PRIVATE_KEYS is required in production');
  return {
    ...c,
    corsOrigins: c.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean),
    isProduction,
    secureCookies: c.APP_ENV === 'production' || c.APP_ENV === 'staging',
  };
}
