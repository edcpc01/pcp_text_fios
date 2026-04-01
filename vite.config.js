import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: true, // Habilita SW em desenvolvimento para testar offline
      },
      includeAssets: [
        'favicon.svg',
        'favicon-32.png',
        'apple-touch-icon.png',
        'robots.txt',
        'icons/icon-192.png',
        'icons/icon-512.png',
        'icons/icon-maskable-512.png',
      ],
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
        categories: ['productivity', 'business'],
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        shortcuts: [
          {
            name: 'Planejamento',
            short_name: 'Planejar',
            description: 'Abrir planejamento de produção',
            url: '/planning',
            icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
          },
          {
            name: 'Realizado',
            short_name: 'Realizado',
            description: 'Ver produção realizada',
            url: '/production',
            icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Cache Firestore com NetworkFirst (dados sempre frescos, mas funciona offline)
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/firestore\.googleapis\.com\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'firestore-cache',
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60, // 1 hora
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Cache Cloud Functions com NetworkFirst
          {
            urlPattern: /^https:\/\/southamerica-east1-.+\.cloudfunctions\.net\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'functions-cache',
              networkTimeoutSeconds: 10,
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 5 * 60, // 5 minutos
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Cache Google Fonts com CacheFirst (estático)
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 ano
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
        // Não fazer cache de rotas de autenticação Firebase
        navigateFallbackDenylist: [/^\/(__\/auth)\//],
      },
    }),
  ],
  resolve: { alias: { '@': '/src' } },
  server: { port: 3000, host: true },
});
