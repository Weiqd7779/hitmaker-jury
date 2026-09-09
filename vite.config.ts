import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vitejs.dev/config/
export default defineConfig({
  envPrefix: 'PUBLIC_',
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    port: 5173,
    strictPort: true,
    host: '127.0.0.1',
    proxy: Object.fromEntries(['/api', '/agents', '/records'].map(path => [path, { target: 'http://127.0.0.1:3001', changeOrigin: true }])),
  },
  preview: {
    host: '127.0.0.1',
    port: 4173,
    strictPort: true,
    proxy: Object.fromEntries(['/api', '/agents', '/records'].map(path => [path, { target: 'http://127.0.0.1:3001', changeOrigin: true }])),
  },
});
