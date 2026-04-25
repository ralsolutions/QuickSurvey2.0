import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: [
        'icons/favicon-16.png',
        'icons/favicon-32.png',
        'icons/apple-touch-icon.png',
      ],
      manifest: {
        name: 'Quick Survey — RAL',
        short_name: 'Quick Survey',
        description: 'Rope access building survey — pin defects, track repairs, review with clients',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'any',
        background_color: '#e4e7ec',
        theme_color: '#111827',
        categories: ['productivity', 'business', 'utilities'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Cache strategies tuned for offline-first behavior
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        runtimeCaching: [
          {
            // Google Fonts CSS — stale-while-revalidate so updates trickle in
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts-stylesheets',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            // Google Fonts files — cache forever (they have hashed URLs)
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
        // Single-page app fallback
        navigateFallback: 'index.html',
        // Don't cache source maps in production
        navigateFallbackDenylist: [/\.map$/],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  build: {
    target: 'es2020',
    minify: 'esbuild',
    sourcemap: false,
    rollupOptions: {
      output: {
        // Manual chunks: split heavy modal code so first paint is faster
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
        },
      },
    },
    // Inline assets smaller than 4KB to reduce HTTP requests
    assetsInlineLimit: 4096,
    // Warn if any chunk goes over 500KB
    chunkSizeWarningLimit: 500,
  },
  // Vercel-friendly: relative URLs so it works at any path
  base: './',
});
