import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves from /<repo>/ - the pages workflow sets GH_PAGES_BASE.
export default defineConfig({
  base: process.env.GH_PAGES_BASE || '/',
  plugins: [react()],
  server: { port: 5173, open: true },
  worker: { format: 'es' },
  build: { outDir: 'dist', chunkSizeWarningLimit: 2000 },
  test: {
    include: ['tests/**/*.test.js'],
    environment: 'node',
  },
});
