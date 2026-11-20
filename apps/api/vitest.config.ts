import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globalSetup: ['./test/global-setup.ts'],
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 60_000,
    env: {
      APP_ENV: 'test',
      NODE_ENV: 'test',
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? 'postgres://app:app@localhost:5432/dairy_test',
      DATABASE_MIGRATOR_URL: process.env.TEST_DATABASE_MIGRATOR_URL ?? 'postgres://migrator:migrator@localhost:5432/dairy_test',
      GOOGLE_WEB_CLIENT_ID: 'test-client.apps.googleusercontent.com',
      RATE_LIMIT_ENABLED: 'false',
      LOG_LEVEL: 'silent',
      MEDIA_DIR: './var/test-media',
      R2_PUBLIC_BASE_URL: 'http://localhost:4000/media',
    },
  },
});
