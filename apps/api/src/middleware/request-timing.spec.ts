import { Hono } from 'hono'
import { describe, expect, it, vi } from 'vitest'
import { REQUEST_TIMING_SLOW_MS, requestTimingMiddleware } from './request-timing.js'

describe('request-timing middleware (M11-S20)', () => {
  it('sets X-Response-Time header', async () => {
    const app = new Hono()
    app.use('*', requestTimingMiddleware)
    app.get('/test', (c) => c.text('ok'))

    const res = await app.request('/test')
    expect(res.headers.get('X-Response-Time')).toMatch(/^\d+ms$/)
  })

  it('logs when duration exceeds REQUEST_TIMING_SLOW_MS', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const app = new Hono()
    app.use('*', requestTimingMiddleware)
    app.get('/slow', async (c) => {
      await new Promise((r) => setTimeout(r, REQUEST_TIMING_SLOW_MS + 50))
      return c.text('slow')
    })

    await app.request('/slow')
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('[performance monitoring]'))
    warn.mockRestore()
  })
})
