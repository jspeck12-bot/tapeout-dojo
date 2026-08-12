import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves from /<repo>/ - the pages workflow sets GH_PAGES_BASE.
// Local dev and normal builds stay at '/'.
export default defineConfig({
  base: process.env.GH_PAGES_BASE || '/',
  plugins: [react()],
  server: { port: 5173, open: true },
  build: { outDir: 'dist', chunkSizeWarningLimit: 2000 },
});
