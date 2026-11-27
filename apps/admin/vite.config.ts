import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: { target: 'es2022', sourcemap: true },
  server: {
    // Works behind preview URLs (Cloud Shell, Codespaces) too.
    host: true,
    allowedHosts: true,
    // In development the admin calls /api on its own address and Vite forwards it to the API, so cookies work everywhere.
    proxy: { '/api': { target: process.env.API_PROXY_TARGET ?? 'http://localhost:4000', rewrite: (p) => p.replace(/^\/api/, '') } },
  },
});
