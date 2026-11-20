import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { fileURLToPath } from 'node:url';

const url = process.env.DATABASE_MIGRATOR_URL ?? 'postgres://migrator:migrator@localhost:5432/dairy';
const sql = postgres(url, { max: 1, onnotice: () => {} });
const folder = fileURLToPath(new URL('../drizzle', import.meta.url));

await migrate(drizzle(sql), { migrationsFolder: folder });
console.log(`migrations applied to ${new URL(url).pathname.slice(1)}`);
await sql.end();
