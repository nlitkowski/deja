import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages serves the app from /<repo>/; the deploy workflow sets BASE_PATH.
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      // `prompt`, not `autoUpdate`: a new version waits for the user's "Recharger" so a session is never reloaded mid-way.
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Déjà',
        short_name: 'Déjà',
        description: 'Révisions de français A1–A2, Édito et connecteurs.',
        lang: 'fr',
        display: 'standalone',
        start_url: base,
        scope: base,
        theme_color: '#1a1f3a',
        background_color: '#faf7f2',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Content packs are bundled into the JS, so precaching the build covers them. Fonts of every style are
        // precached so switching styles works offline, but only the subsets French and Polish need, as woff2.
        globPatterns: ['**/*.{js,css,html,svg,png}', '**/*-latin-*.woff2'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: `${base}index.html`,
        // Sign-in is a page navigation to /api/auth/…; answering it with the cached app would swallow the redirect.
        navigateFallbackDenylist: [new RegExp(`^${base}api/`)],
      },
    }),
  ],
  server: {
    // The API runs in `wrangler dev` (npm run dev:worker); without it /api answers 502 and the account card stays hidden.
    proxy: { '/api': 'http://127.0.0.1:8787' },
  },
  build: {
    // Never inline fonts: a style's fonts should only download when that style is in use.
    assetsInlineLimit: (file) => (/\.woff2?$/.test(file) ? false : undefined),
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'worker/**/*.test.ts'],
  },
});
