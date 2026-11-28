import { writeFileSync } from 'node:fs';
import { buildApp } from '../app';
import { loadConfig } from '../config';
import { createGoogleVerifier } from '../services/google';
import { createMemoryKv } from '../services/kv';
import { createMockProvider } from '../services/payments';
import { TokenService } from '../services/tokens';
import { createDb } from '@dairy/db';

// Builds the app without connecting and writes the generated OpenAPI document.
const config = loadConfig({
  ...process.env,
  PUBLIC_API_URL: process.env.SPEC_SERVER_URL ?? 'https://api.example.in',
  DATABASE_URL: process.env.DATABASE_URL ?? 'postgres://x@localhost/x',
  RATE_LIMIT_ENABLED: 'false',
});
const db = createDb(config.DATABASE_URL, { max: 1 });
const app = await buildApp(
  { config, db, kv: createMemoryKv(), tokens: await TokenService.fromConfig('', 'spec', true), google: createGoogleVerifier('spec'), payments: createMockProvider(), now: () => new Date() },
  { logger: false },
);
await app.ready();
const out = process.argv[2] ?? 'openapi.generated.json';
writeFileSync(out, JSON.stringify(app.swagger(), null, 2));
console.log(`wrote ${out}`);
await app.close();
await db.close();
