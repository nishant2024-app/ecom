import { buildApp } from './app';
import { createDeps } from './bootstrap';
import { ConfigError } from './config';

try {
  const deps = await createDeps();
  const app = await buildApp(deps);
  const close = async (signal: string) => {
    app.log.info({ signal }, 'shutting down');
    await app.close();
    await deps.db.close();
    await deps.kv.close();
    process.exit(0);
  };
  process.on('SIGTERM', () => void close('SIGTERM'));
  process.on('SIGINT', () => void close('SIGINT'));
  await app.listen({ port: deps.config.API_PORT, host: '0.0.0.0' });
} catch (err) {
  if (err instanceof ConfigError) {
    console.error(err.message);
    process.exit(1);
  }
  throw err;
}
