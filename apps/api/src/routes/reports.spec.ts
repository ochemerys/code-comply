import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Hono } from 'hono'
import reportsRoutes from './reports.js'
import { reportService, REPORT_SIGNED_URL_TTL_SECONDS } from '../services/report.service.js'
import { inspectionService } from '../services/inspection.service.js'

vi.mock('../services/report.service.js', async () => {
  const actual = await vi.importActual<typeof import('../services/report.service.js')>(
    '../services/report.service.js',
  )
  return {
    ...actual,
    reportService: {
      generateAndStore: vi.fn(),
      getById: vi.fn(),
      getSignedDownloadUrl: vi.fn(),
      listForInspection: vi.fn(),
    },
  }
})

vi.mock('../services/inspection.service.js', () => ({
  inspectionService: {
    getById: vi.fn(),
  },
}))

const createTestApp = () => {
  const testApp = new Hono<{ Variables: { userId: string } }>()
  testApp.use('*', async (c, next) => {
    c.set('userId', 'user-123')
    await next()
  })
  testApp.route('/', reportsRoutes)
  return testApp
}

describe('Reports routes (M10-S9)', () => {
  const generatedAt = new Date('2026-06-01T16:00:00.000Z')

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(inspectionService.getById).mockResolvedValue({
      id: 'insp-1',
      uniqueId: 'RPT-INSP-1',
    } as any)
  })

  it('POST /generate returns 201 and ReportDTO', async () => {
    vi.mocked(reportService.generateAndStore).mockResolvedValue({
      id: 'rep-1',
      inspectionId: 'insp-1',
      type: 'INSPECTION',
      filename: 'inspection-report.pdf',
      storageKey: 'reports/insp-1/file.pdf',
      hash: 'b'.repeat(64),
      generatedAt,
      distributedAt: null,
    } as any)

    const app = createTestApp()
    const res = await app.request('/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inspectionId: 'insp-1', type: 'INSPECTION' }),
    })

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body).toMatchObject({
      id: 'rep-1',
      inspectionId: 'insp-1',
      type: 'INSPECTION',
      filename: 'inspection-report.pdf',
      storageKey: 'reports/insp-1/file.pdf',
      hash: 'b'.repeat(64),
      generatedAt: generatedAt.toISOString(),
      distributedAt: null,
      uniqueReportId: 'RPT-INSP-1',
    })
    expect(body.verifyUrl).toContain('/reports/verify/rep-1?hash=')
  })

  it('POST /generate returns 404 when inspection is missing', async () => {
    vi.mocked(inspectionService.getById).mockResolvedValue(null)

    const app = createTestApp()
    const res = await app.request('/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inspectionId: 'missing', type: 'INSPECTION' }),
    })

    expect(res.status).toBe(404)
    expect(reportService.generateAndStore).not.toHaveBeenCalled()
  })

  it('POST /generate returns 400 when STOP_WORK is missing deficiencyId', async () => {
    const app = createTestApp()
    const res = await app.request('/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inspectionId: 'insp-1', type: 'STOP_WORK' }),
    })

    expect(res.status).toBe(400)
    expect(reportService.generateAndStore).not.toHaveBeenCalled()
  })

  it('POST /generate returns 403 when inspection access is unauthorized', async () => {
    vi.mocked(inspectionService.getById).mockRejectedValue(new Error('Unauthorized inspection'))

    const app = createTestApp()
    const res = await app.request('/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inspectionId: 'insp-1', type: 'INSPECTION' }),
    })

    expect(res.status).toBe(403)
  })

  it('POST /generate returns 500 on unexpected service error', async () => {
    vi.mocked(reportService.generateAndStore).mockRejectedValue(new Error('R2 unavailable'))

    const app = createTestApp()
    const res = await app.request('/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inspectionId: 'insp-1', type: 'INSPECTION' }),
    })

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Internal error')
  })

  it('GET /:id/download returns signed URL', async () => {
    vi.mocked(reportService.getById).mockResolvedValue({
      id: 'rep-1',
      inspectionId: 'insp-1',
    } as any)
    vi.mocked(reportService.getSignedDownloadUrl).mockResolvedValue('https://r2.example/signed.pdf')

    const app = createTestApp()
    const res = await app.request('/rep-1/download')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      url: 'https://r2.example/signed.pdf',
      expiresIn: REPORT_SIGNED_URL_TTL_SECONDS,
    })
  })

  it('GET /:id/download returns 404 when report is missing', async () => {
    vi.mocked(reportService.getById).mockResolvedValue(null)

    const app = createTestApp()
    const res = await app.request('/missing/download')

    expect(res.status).toBe(404)
    expect(reportService.getSignedDownloadUrl).not.toHaveBeenCalled()
  })

  it('GET /:id/download returns 404 when inspection access is denied', async () => {
    vi.mocked(reportService.getById).mockResolvedValue({
      id: 'rep-1',
      inspectionId: 'insp-1',
    } as any)
    vi.mocked(inspectionService.getById).mockResolvedValue(null)

    const app = createTestApp()
    const res = await app.request('/rep-1/download')

    expect(res.status).toBe(404)
    expect(reportService.getSignedDownloadUrl).not.toHaveBeenCalled()
  })

  it('GET /:id/download returns 500 when signing fails', async () => {
    vi.mocked(reportService.getById).mockResolvedValue({
      id: 'rep-1',
      inspectionId: 'insp-1',
    } as any)
    vi.mocked(reportService.getSignedDownloadUrl).mockRejectedValue(new Error('signing failed'))

    const app = createTestApp()
    const res = await app.request('/rep-1/download')

    expect(res.status).toBe(500)
  })
})
