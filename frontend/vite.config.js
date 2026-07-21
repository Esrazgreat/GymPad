import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Proxy the API in dev so the browser sees a single origin and we never
    // touch CORS or cookie-domain issues locally.
    proxy: {
      '/api': {
        target: process.env.VITE_API_BASE_URL || 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  build: {
    // Three.js and Recharts are both large and only needed on one screen each.
    // Splitting them keeps the initial bundle small — this matters on the
    // mid-range Android phones and metered data this app is built for.
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          charts: ['recharts'],
        },
      },
    },
    chunkSizeWarningLimit: 900,
  },
});
