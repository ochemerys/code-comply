import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@sentry/node', () => ({
  init: vi.fn(),
  captureException: vi.fn(),
}))

describe('sentry (M11-S20)', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('does not initialize without SENTRY_DSN', async () => {
    const { initSentry, isSentryInitialized } = await import('./sentry.js')
    initSentry()
    expect(isSentryInitialized()).toBe(false)
  })

  it('initializes when SENTRY_DSN is set', async () => {
    vi.stubEnv('SENTRY_DSN', 'https://example@o0.ingest.sentry.io/0')
    vi.stubEnv('NODE_ENV', 'production')
    const Sentry = await import('@sentry/node')
    const { initSentry, isSentryInitialized } = await import('./sentry.js')
    initSentry()
    expect(isSentryInitialized()).toBe(true)
    expect(Sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: 'https://example@o0.ingest.sentry.io/0',
        tracesSampleRate: 0.2,
      }),
    )
  })

  it('captureException is a no-op when Sentry is not initialized', async () => {
    const Sentry = await import('@sentry/node')
    const { captureException } = await import('./sentry.js')
    captureException(new Error('test'))
    expect(Sentry.captureException).not.toHaveBeenCalled()
  })
})
