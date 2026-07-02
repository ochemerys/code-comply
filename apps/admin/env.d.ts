/// <reference types="vite/client" />

interface ImportMetaEnv {
  // API base URL. Required in production; empty/absent in dev (same-origin proxy) and test.
  readonly VITE_API_URL?: string
  // Idle auto-logout timings in milliseconds (optional; defaults in idle-logout-config.ts).
  readonly VITE_IDLE_WARN_MS?: string
  readonly VITE_IDLE_LOGOUT_MS?: string
  // Sentry DSN; monitoring is disabled when unset (optional).
  readonly VITE_SENTRY_DSN?: string
  // Deployment environment label reported to Sentry (optional; defaults to import.meta.env.MODE).
  readonly VITE_APP_ENV?: string
  // Extra CSP connect-src origins, space-separated (optional; consumed in vite.config.ts).
  readonly VITE_CSP_CONNECT_SRC?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/ban-types
  const component: DefineComponent<Record<string, never>, Record<string, never>, any>
  export default component
}
