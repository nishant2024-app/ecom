import { defineConfig } from 'tsup';

// Bundle workspace packages (they ship TypeScript source); keep npm deps external.
export default defineConfig({
  entry: ['src/server.ts', 'src/worker.ts'],
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  sourcemap: true,
  clean: true,
  noExternal: [/^@dairy\//],
});
