import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Hono } from 'hono'
import codesRoutes from './codes'
import { codeLibraryService } from '../services/code-library.service'

vi.mock('../services/code-library.service')

const createTestApp = () => {
  const testApp = new Hono()
  testApp.use('*', async (c, next) => {
    c.set('userId', 'user-123')
    await next()
  })
  testApp.route('/', codesRoutes)
  return testApp
}

describe('Codes Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /', () => {
    it('returns 400 when q and type are missing', async () => {
      const app = createTestApp()
      const res = await app.request('/')
      expect(res.status).toBe(400)
    })

    it('searches by q', async () => {
      vi.mocked(codeLibraryService.search).mockResolvedValue([
        { id: '1', code: 'NBC', section: '9.10.1', title: 'Fire', description: null },
      ])

      const app = createTestApp()
      const res = await app.request('/?q=Fire')
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data).toHaveLength(1)
      expect(data[0].code).toBe('NBC')
    })

    it('narrows search by type when both q and type set', async () => {
      vi.mocked(codeLibraryService.search).mockResolvedValue([
        { id: '1', code: 'NBC', section: '1', title: 'A', description: null },
        { id: '2', code: 'IFC', section: '2', title: 'B', description: null },
      ])

      const app = createTestApp()
      const res = await app.request('/?q=test&type=NBC')
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data).toHaveLength(1)
      expect(data[0].code).toBe('NBC')
    })

    it('lists by type when only type is set', async () => {
      vi.mocked(codeLibraryService.listByType).mockResolvedValue([
        { id: '1', code: 'NBC', section: '9.10.1', title: 'T', description: null },
      ])

      const app = createTestApp()
      const res = await app.request('/?type=NBC')
      expect(res.status).toBe(200)
      expect(codeLibraryService.listByType).toHaveBeenCalledWith('NBC')
    })

    it('returns 500 when search throws', async () => {
      vi.mocked(codeLibraryService.search).mockRejectedValue(new Error('db'))

      const app = createTestApp()
      const res = await app.request('/?q=x')
      expect(res.status).toBe(500)
    })
  })

  describe('GET /:code/:section', () => {
    it('returns a code reference', async () => {
      vi.mocked(codeLibraryService.getByCode).mockResolvedValue({
        id: '1',
        code: 'NBC',
        section: '9.10.1',
        title: 'Fire separation',
        description: null,
      })

      const app = createTestApp()
      const res = await app.request('/NBC/9.10.1')
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.section).toBe('9.10.1')
    })

    it('returns 404 when not found', async () => {
      vi.mocked(codeLibraryService.getByCode).mockResolvedValue(null)

      const app = createTestApp()
      const res = await app.request('/NBC/0.0.0')
      expect(res.status).toBe(404)
    })

    it('returns 500 on unexpected lookup error', async () => {
      vi.mocked(codeLibraryService.getByCode).mockRejectedValue(new Error('db error'))

      const app = createTestApp()
      const res = await app.request('/NBC/1.1.1')
      expect(res.status).toBe(500)
    })
  })
})
