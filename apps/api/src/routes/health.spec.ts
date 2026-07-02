import { describe, it, expect, vi } from 'vitest'
import { Hono } from 'hono'
import healthRoutes from './health'

// Mock Prisma
vi.mock('@codecomply/db', () => ({
  prisma: {
    $queryRaw: vi.fn().mockResolvedValue(true),
  },
}))

describe('Health Routes', () => {
  const app = new Hono()
  app.route('/health', healthRoutes)

  it('should return ok status', async () => {
    const res = await app.request('/health')
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.status).toBe('ok')
    expect(data.timestamp).toBeDefined()
    expect(data.database).toBe('connected')
  })
})
