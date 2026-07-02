import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'
import {
  formatInspectorCspContent,
  injectCspMetaIntoHtml,
  resolveInspectorCspDirectives,
} from './src/lib/csp-policy'
import { isPwaDevEnabled } from './src/lib/pwa/env'

function inspectorCspMetaPlugin(): Plugin {
  return {
    name: 'inspector-csp-meta',
    transformIndexHtml(html) {
      const directives = resolveInspectorCspDirectives({
        apiUrl: process.env.VITE_API_URL,
        sentryDsn: process.env.VITE_SENTRY_DSN,
        extraConnectSrc: process.env.VITE_CSP_CONNECT_SRC,
      })
      return injectCspMetaIntoHtml(html, formatInspectorCspContent(directives))
    },
  }
}

export default defineConfig({
  plugins: [
    vue(),
    inspectorCspMetaPlugin(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.ico',
        'robots.txt',
        'apple-touch-icon.png',
        'screenshots/home-tablet.png',
        'screenshots/home-phone.png',
      ],
      manifest: {
        id: '/?source=pwa',
        name: 'CodeComply Field',
        short_name: 'CodeComply Field',
        description: 'Offline-first inspection management for safety codes officers',
        theme_color: '#1e40af',
        background_color: '#ffffff',
        display: 'standalone',
        display_override: ['window-controls-overlay', 'standalone'],
        orientation: 'any', // mobile-first-design-guide.md §9 — tablet-first / all orientations
        scope: '/',
        start_url: '/',
        lang: 'en-CA',
        dir: 'ltr',
        categories: ['business', 'productivity', 'utilities'],
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: '/pwa-monochrome.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'monochrome',
          },
        ],
        screenshots: [
          {
            src: '/screenshots/home-tablet.png',
            sizes: '1280x800',
            type: 'image/png',
            form_factor: 'wide',
            label: 'Home',
          },
          {
            src: '/screenshots/home-phone.png',
            sizes: '750x1334',
            type: 'image/png',
            form_factor: 'narrow',
            label: 'Home',
          },
        ],
        shortcuts: [
          {
            name: 'Find permits near me',
            short_name: 'Find near me',
            url: '/permits?find=1',
            icons: [{ src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' }],
          },
          {
            name: 'My assignments',
            short_name: 'Assignments',
            url: '/permits',
            icons: [{ src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' }],
          },
        ],
      },
      injectManifest: {
        // Single-file SW output so workbox can find `self.__WB_MANIFEST` for injection.
        rollupFormat: 'iife',
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      },
      devOptions: {
        // IMPORTANT: enabling PWA dev SW can stale-cache Vite chunks and manifest “blank pages” during HMR.
        // Opt-in explicitly with `VITE_ENABLE_PWA_DEV=true pnpm dev` when you need SW/offline debugging.
        enabled: isPwaDevEnabled({
          PROD: false,
          VITE_ENABLE_PWA_DEV: process.env.VITE_ENABLE_PWA_DEV,
        }),
        type: 'module',
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@codecomply/ui': path.resolve(__dirname, '../../packages/ui/src'),
      '@codecomply/utils': path.resolve(__dirname, '../../packages/utils/src'),
      '@codecomply/contracts': path.resolve(__dirname, '../../packages/contracts/src'),
    },
  },
  server: {
    port: parseInt(process.env.PORT || '5175', 10),
    proxy: {
      // Auth lives at /auth/* on the API (not under /api); proxy so the PWA can use same-origin URLs in dev.
      '/auth': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/fabric')) return 'vendor-fabric'
          if (id.includes('node_modules/crypto-js')) return 'vendor-crypto'
        },
      },
    },
  },
})
