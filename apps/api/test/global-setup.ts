import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/** Fresh test database: reset, migrate, seed. Refuses anything that isn't a *_test database. */
export default function setup() {
  const migrator = process.env.TEST_DATABASE_MIGRATOR_URL ?? 'postgres://migrator:migrator@localhost:5432/dairy_test';
  const app = process.env.TEST_DATABASE_URL ?? 'postgres://app:app@localhost:5432/dairy_test';
  if (!new URL(migrator).pathname.endsWith('_test')) throw new Error('tests must run against a *_test database');
  const cwd = fileURLToPath(new URL('../../../packages/db', import.meta.url));
  const env = { ...process.env, APP_ENV: 'test', DATABASE_MIGRATOR_URL: migrator, DATABASE_URL: app };
  for (const script of ['scripts/reset.ts', 'scripts/migrate.ts', 'scripts/seed.ts']) {
    execFileSync('npx', ['tsx', script], { cwd, env, stdio: 'pipe' });
  }
}
