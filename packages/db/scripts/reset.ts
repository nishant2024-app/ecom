import postgres from 'postgres';

const url = process.env.DATABASE_MIGRATOR_URL ?? 'postgres://migrator:migrator@localhost:5432/dairy';
if (process.env.APP_ENV === 'production' || process.env.APP_ENV === 'staging') {
  console.error('refusing to reset a staging or production database');
  process.exit(1);
}
const sql = postgres(url, { max: 1, onnotice: () => {} });
await sql.unsafe(`
  DROP SCHEMA IF EXISTS drizzle CASCADE;
  DROP SCHEMA public CASCADE;
  CREATE SCHEMA public;
  GRANT ALL ON SCHEMA public TO public;
`);
console.log('database reset');
await sql.end();
