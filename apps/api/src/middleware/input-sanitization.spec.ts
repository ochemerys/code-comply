import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import { inputSanitizationMiddleware } from './input-sanitization.js'

describe('inputSanitizationMiddleware (M11-S5)', () => {
  it('sanitizes JSON bodies on mutating requests', async () => {
    const app = new Hono()
    app.use('*', inputSanitizationMiddleware())
    app.post('/echo', async (c) => c.json(await c.req.json()))

    const res = await app.request('/echo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: '<script>alert(1)</script>Safe text here for testing.',
      }),
    })

    expect(res.status).toBe(200)
    const body = (await res.json()) as { description: string }
    expect(body.description).not.toContain('<script>')
    expect(body.description).toContain('Safe text here')
  })

  it('does not modify GET requests', async () => {
    const app = new Hono()
    app.use('*', inputSanitizationMiddleware())
    app.get('/health', (c) => c.json({ status: 'ok' }))

    const res = await app.request('/health')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'ok' })
  })
})
