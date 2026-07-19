import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png'],
      manifest: false, // We use our own manifest.webmanifest in public/
      workbox: {
        // Precache app shell (HTML, CSS, JS bundles)
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],

        runtimeCaching: [
          // CacheFirst for static assets (images, fonts, etc.)
          {
            urlPattern: /\/assets\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'static-assets',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          // StaleWhileRevalidate for read API calls (GET)
          {
            urlPattern: /\/api\/.*$/i,
            method: 'GET',
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'api-read-cache',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 24 * 60 * 60, // 1 day
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          // NetworkFirst for config endpoints (theme, settings)
          {
            urlPattern: /\/api\/theme\/current/i,
            method: 'GET',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'config-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
              networkTimeoutSeconds: 5,
            },
          },
          // NetworkOnly for write API calls (POST, PATCH, PUT, DELETE)
          {
            urlPattern: /\/api\/.*$/i,
            method: 'POST',
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /\/api\/.*$/i,
            method: 'PUT',
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /\/api\/.*$/i,
            method: 'PATCH',
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /\/api\/.*$/i,
            method: 'DELETE',
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@historial/shared-types': path.resolve(__dirname, '../../packages/shared-types/src'),
      '@historial/validators': path.resolve(__dirname, '../../packages/validators/src'),
      '@historial/constants': path.resolve(__dirname, '../../packages/constants/src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ''),
      },
    },
  },
});
