import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_MIGRATOR_URL ?? 'postgres://migrator:migrator@localhost:5432/dairy',
  },
  strict: true,
  verbose: true,
});
