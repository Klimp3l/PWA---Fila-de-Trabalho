import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
// Deve coincidir com o caminho público onde o `dist` é servido (ex.: .../pwa/fila/).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const proxyTarget = env.VITE_API_BASE_URL?.trim()

  return {
    base: '/bdoserver2.7/pwa/fila/',
    server: {
      proxy: proxyTarget
        ? {
          '/bdoserver2.7/odwctrl': {
            target: proxyTarget,
            changeOrigin: true,
            secure: false,
          },
        }
        : undefined,
    },
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg'],
        manifest: {
          name: 'Fila de Trabalho',
          short_name: 'FilaTrabalho',
          description: 'PWA offline-first da Fila de Trabalho',
          theme_color: '#0b3558',
          background_color: '#f3f7fb',
          display: 'standalone',
          start_url: '.',
          scope: '.',
          lang: 'pt-BR',
          icons: [
            {
              src: 'favicon.svg',
              sizes: 'any',
              type: 'image/svg+xml',
              purpose: 'any',
            },
          ],
        },
        workbox: {
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
          runtimeCaching: [
            {
              urlPattern: ({ request }) => request.destination === 'document',
              handler: 'NetworkFirst',
              options: {
                cacheName: 'documents-cache',
                networkTimeoutSeconds: 5,
              },
            },
            {
              urlPattern: ({ request }) =>
                ['style', 'script', 'worker'].includes(request.destination),
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'assets-cache',
              },
            },
            {
              urlPattern: ({ request }) => request.destination === 'image',
              handler: 'CacheFirst',
              options: {
                cacheName: 'images-cache',
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 60 * 60 * 24 * 30,
                },
              },
            },
            {
              urlPattern: ({ url }) =>
                url.pathname.includes('/bdoserver2.7/odwctrl')
                && url.searchParams.get('scriptFunction') === 'getAtividades',
              handler: 'NetworkFirst',
              options: {
                cacheName: 'api-atividades-cache',
                networkTimeoutSeconds: 3,
                cacheableResponse: {
                  statuses: [200],
                },
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 2,
                },
              },
            },
            {
              urlPattern: ({ url }) =>
                url.pathname.includes('/bdoserver2.7/odwctrl')
                && ['logout', 'getParameters', 'login'].includes(url.searchParams.get('action') ?? ''),
              handler: 'NetworkOnly',
            },
            {
              urlPattern: /\/bdoserver2\.7\/odwctrl/,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'api-cache',
                networkTimeoutSeconds: 5,
                cacheableResponse: {
                  statuses: [200],
                },
                expiration: {
                  maxEntries: 30,
                  maxAgeSeconds: 60 * 10,
                },
              },
            },
          ],
        },
      }),
    ],
  }
})
