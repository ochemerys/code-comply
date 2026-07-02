import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Hono } from 'hono'
import deficienciesRoutes from './deficiencies.js'
import { deficiencyService } from '../services/deficiency.service.js'
import { vocService } from '../services/voc.service.js'
import { DeficiencyMapper } from '../mappers/deficiency.mapper.js'
import { VoCMapper } from '../mappers/voc.mapper.js'

vi.mock('../services/deficiency.service.js')
vi.mock('../services/voc.service.js')
vi.mock('../mappers/deficiency.mapper.js')
vi.mock('../mappers/voc.mapper.js')

const createTestApp = () => {
  const testApp = new Hono<{ Variables: { userId: string } }>()
  testApp.use('*', async (c, next) => {
    c.set('userId', 'user-123')
    await next()
  })
  testApp.route('/', deficienciesRoutes)
  return testApp
}

describe('Deficiencies routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('GET / returns mapped deficiencies', async () => {
    const rows = [{ id: 'd1' }] as any
    const dtos = [
      { id: 'd1', clientId: 'c1', inspectionId: 'i1', description: 'x'.repeat(12) },
    ] as any
    vi.mocked(deficiencyService.list).mockResolvedValue(rows)
    vi.mocked(DeficiencyMapper.toDTOs).mockReturnValue(dtos)

    const app = createTestApp()
    const res = await app.request('/?inspectionId=insp-1')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(dtos)
    expect(deficiencyService.list).toHaveBeenCalledWith({
      userId: 'user-123',
      inspectionId: 'insp-1',
      status: undefined,
      severity: undefined,
    })
  })

  it('GET /:id returns 404 when missing', async () => {
    vi.mocked(deficiencyService.getById).mockResolvedValue(null)

    const app = createTestApp()
    const res = await app.request('/missing')
    expect(res.status).toBe(404)
  })

  it('GET /:id/voc returns mapped VoC when linked', async () => {
    const deficiencyRow = { id: 'd1' } as any
    const vocRow = { id: 'voc-1', deficiencyId: 'd1' } as any
    const vocDto = {
      id: 'voc-1',
      deficiencyId: 'd1',
      verificationDate: '2026-01-01T00:00:00.000Z',
      sectionTitle: 'A',
      title: 'Inspector',
      name: 'Jane',
      method: 'SITE_VISIT',
      status: 'PENDING',
    }
    vi.mocked(deficiencyService.getById).mockResolvedValue(deficiencyRow)
    vi.mocked(vocService.getByDeficiency).mockResolvedValue(vocRow)
    vi.mocked(VoCMapper.toDTO).mockReturnValue(vocDto as any)

    const app = createTestApp()
    const res = await app.request('/d1/voc')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(vocDto)
  })

  it('GET /:id/voc returns 200 with null when VoC missing', async () => {
    vi.mocked(deficiencyService.getById).mockResolvedValue({ id: 'd1' } as any)
    vi.mocked(vocService.getByDeficiency).mockResolvedValue(null)

    const app = createTestApp()
    const res = await app.request('/d1/voc')
    expect(res.status).toBe(200)
    expect(await res.json()).toBeNull()
  })

  it('POST / creates and returns 201', async () => {
    const row = { id: 'd1' } as any
    const dto = {
      id: 'd1',
      clientId: 'c1',
      inspectionId: 'i1',
      description: 'At least ten characters here',
      severity: 'MAJOR',
      status: 'OPEN',
      isStopWork: false,
      isUnsafe: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }
    vi.mocked(deficiencyService.create).mockResolvedValue(row)
    vi.mocked(DeficiencyMapper.toDTO).mockReturnValue(dto as any)

    const app = createTestApp()
    const res = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: 'c1',
        inspectionId: 'i1',
        description: 'At least ten characters here',
        severity: 'MAJOR',
      }),
    })
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual(dto)
  })

  it('PATCH /:id sets ETag header', async () => {
    const row = { id: 'd1', etag: 'e-new' } as any
    const dto = {
      id: 'd1',
      description: 'Updated text ok',
      clientId: 'c',
      inspectionId: 'i',
      severity: 'MINOR',
      status: 'OPEN',
      isStopWork: false,
      isUnsafe: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }
    vi.mocked(deficiencyService.update).mockResolvedValue(row)
    vi.mocked(DeficiencyMapper.toDTO).mockReturnValue(dto as any)

    const app = createTestApp()
    const res = await app.request('/d1', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'If-Match': '"e-old"',
      },
      body: JSON.stringify({ description: 'Updated text ok' }),
    })
    expect(res.status).toBe(200)
    expect(res.headers.get('ETag')).toBe('e-new')
    expect(deficiencyService.update).toHaveBeenCalledWith(
      'd1',
      'user-123',
      { description: 'Updated text ok' },
      'e-old',
    )
  })

  it('PATCH /:id returns 409 on ETag conflict', async () => {
    vi.mocked(deficiencyService.update).mockRejectedValue(
      new Error('Optimistic concurrency conflict: ETag mismatch'),
    )

    const app = createTestApp()
    const res = await app.request('/d1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'If-Match': 'wrong' },
      body: JSON.stringify({ description: 'Updated text ok' }),
    })
    expect(res.status).toBe(409)
  })

  it('DELETE /:id returns 204', async () => {
    vi.mocked(deficiencyService.delete).mockResolvedValue(undefined)

    const app = createTestApp()
    const res = await app.request('/d1', { method: 'DELETE' })
    expect(res.status).toBe(204)
  })

  it('POST /:id/stop-work returns Stop Work DTO', async () => {
    const swo = {
      id: 'swo-d1',
      deficiencyId: 'd1',
      inspectionId: 'i1',
      issuedAt: '2026-01-02T00:00:00.000Z',
    }
    vi.mocked(deficiencyService.createStopWorkOrder).mockResolvedValue(swo)

    const app = createTestApp()
    const res = await app.request('/d1/stop-work', { method: 'POST' })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(swo)
  })
})
