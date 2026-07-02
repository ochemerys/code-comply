/**
 * M11-S20 — Sentry error tracking (initialized when SENTRY_DSN is set).
 */
import * as Sentry from '@sentry/node'

let initialized = false

export function isSentryConfigured(): boolean {
  return Boolean(process.env.SENTRY_DSN?.trim())
}

export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN?.trim()
  if (!dsn || initialized) return

  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? 'development',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,
  })
  initialized = true
}

export function captureException(error: unknown): void {
  if (!initialized) return
  Sentry.captureException(error)
}

export function isSentryInitialized(): boolean {
  return initialized
}
