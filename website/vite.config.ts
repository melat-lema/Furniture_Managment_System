import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// In development the website asks the backend (port 3000) for the catalog through /api.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5174,
    proxy: { '/api': { target: 'http://localhost:3000', changeOrigin: true } },
  },
  build: {
    rollupOptions: {
      output: { manualChunks: { three: ['three'], motion: ['framer-motion'] } },
    },
  },
});
