import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import {
  DEFAULT_ADMIN_CSP_DIRECTIVES,
  formatAdminCspContent,
  injectCspMetaIntoHtml,
  resolveAdminCspDirectives,
} from './src/lib/csp-policy'

/**
 * `frame-ancestors` is ignored when delivered via a <meta> tag, so it (and the
 * legacy X-Frame-Options fallback) must be sent as HTTP response headers.
 * In production these belong on the host/CDN/reverse proxy serving the SPA.
 */
const SECURITY_RESPONSE_HEADERS: Record<string, string> = {
  'Content-Security-Policy': `frame-ancestors ${DEFAULT_ADMIN_CSP_DIRECTIVES['frame-ancestors']}`,
  'X-Frame-Options': 'DENY',
}

function adminCspMetaPlugin(): Plugin {
  return {
    name: 'admin-csp-meta',
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        const isDev = Boolean(ctx.server)
        const directives = resolveAdminCspDirectives({
          apiUrl: process.env.VITE_API_URL,
          sentryDsn: process.env.VITE_SENTRY_DSN,
          extraConnectSrc: process.env.VITE_CSP_CONNECT_SRC,
          isDev,
        })
        return injectCspMetaIntoHtml(html, formatAdminCspContent(directives))
      },
    },
  }
}

export default defineConfig({
  plugins: [vue(), adminCspMetaPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@codecomply/ui': path.resolve(__dirname, '../../packages/ui/src'),
      '@codecomply/utils': path.resolve(__dirname, '../../packages/utils/src'),
    },
  },
  server: {
    port: parseInt(process.env.PORT || '5174', 10),
    headers: SECURITY_RESPONSE_HEADERS,
    proxy: {
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
  preview: {
    headers: SECURITY_RESPONSE_HEADERS,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('@fullcalendar')) return 'vendor-fullcalendar'
        },
      },
    },
  },
})
