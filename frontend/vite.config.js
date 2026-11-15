import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'FarmShift — crops that fit your field',
        short_name: 'FarmShift',
        description: 'NASA rainfall and temperature, matched to the crops that will grow in your field.',
        theme_color: '#FBFCFA',
        background_color: '#FBFCFA',
        display: 'standalone',
        start_url: './',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: 'index.html',
        // Nineteen crops, two sizes each, are real high-resolution photographs.
        // They are cached the first time a farmer sees them rather than
        // blocking the install on ~5 MB.
        runtimeCaching: [
          {
            urlPattern: /\/crops\/[a-z_-]+\.webp$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'crop-photos',
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 60 },
            },
          },
          {
            urlPattern: /\/hero\.jpg$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'hero-photo',
              expiration: { maxEntries: 2, maxAgeSeconds: 60 * 60 * 24 * 60 },
            },
          },
        ],
        // The data explorer is a separate page; never answer it with the app shell.
        navigateFallbackDenylist: [/^\/data(\.html)?$/],
      },
      devOptions: { enabled: false },
    }),
  ],
  server: {
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET ?? 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
    },
  },
  preview: {
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
  build: {
    target: 'es2020',
    rollupOptions: {
      // Two pages: the farmer app (index.html) and the NASA data explorer
      // (data.html), kept separate so their styles never mix.
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        data: fileURLToPath(new URL('./data.html', import.meta.url)),
      },
    },
  },
})
