/**
 * M11-S20 — Sentry error tracking for Admin portal (VITE_SENTRY_DSN).
 */
import type { App } from 'vue'
import * as Sentry from '@sentry/vue'

let initialized = false

function getDsn(): string | undefined {
  const dsn = import.meta.env.VITE_SENTRY_DSN
  return typeof dsn === 'string' && dsn.trim() ? dsn.trim() : undefined
}

export function initSentry(app: App): void {
  const dsn = getDsn()
  if (!dsn || initialized) return

  Sentry.init({
    app,
    dsn,
    environment: import.meta.env.VITE_APP_ENV ?? import.meta.env.MODE,
    tracesSampleRate: import.meta.env.PROD ? 0.2 : 1.0,
  })
  initialized = true
}
