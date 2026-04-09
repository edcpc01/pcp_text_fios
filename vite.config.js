import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // autoUpdate: o SW gerado pelo Workbox chama skipWaiting() + clients.claim()
      // automaticamente via o módulo virtual 'virtual:pwa-register'.
      registerType: 'autoUpdate',
      // injectRegister: null → registramos manualmente no main.jsx para ter
      // controle total e garantir que o módulo virtual seja importado.
      injectRegister: null,
      devOptions: { enabled: true },
      includeAssets: ['favicon.svg', 'favicon-32.png', 'apple-touch-icon.png', 'robots.txt'],
      manifest: {
        name: 'Corradi — Planejamento de Produção',
        short_name: 'Corradi',
        description: 'Planejamento de produção de fios texturizados — Doptex & Corradi',
        theme_color: '#0c1222',
        background_color: '#0c1222',
        display: 'standalone',
        display_override: ['window-controls-overlay', 'standalone', 'minimal-ui'],
        orientation: 'any',
        scope: '/',
        start_url: '/',
        lang: 'pt-BR',
        icons: [
          { src: '/icons/icon-192.png',          sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png',          sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: '/favicon.svg',                 sizes: 'any',     type: 'image/svg+xml', purpose: 'any' },
        ],
        shortcuts: [
          { name: 'Planejamento', url: '/planning', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
          { name: 'Realizado', url: '/production', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // skipWaiting e clientsClaim são injetados automaticamente pelo Workbox
        // quando registerType: 'autoUpdate' é usado.
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/firestore\.googleapis\.com\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'firestore-cache',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 100, maxAgeSeconds: 3600 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 31536000 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  resolve: { alias: { '@': '/src' } },
  server: { port: 3000, host: true },
});
