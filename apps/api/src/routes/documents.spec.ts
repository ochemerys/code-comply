import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Hono } from 'hono'
import documentsRoutes, { MAX_DOCUMENT_UPLOAD_BYTES } from './documents.js'
import { documentService, DOCUMENT_SIGNED_URL_TTL_SECONDS } from '../services/document.service.js'
import { inspectionService } from '../services/inspection.service.js'

vi.mock('../services/document.service.js', async () => {
  const actual = await vi.importActual<typeof import('../services/document.service.js')>(
    '../services/document.service.js',
  )
  return {
    ...actual,
    documentService: {
      upload: vi.fn(),
      getById: vi.fn(),
      getSignedUrl: vi.fn(),
      delete: vi.fn(),
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
  testApp.route('/', documentsRoutes)
  return testApp
}

describe('Documents routes (M7-S9)', () => {
  const sampleDoc = {
    id: 'doc-1',
    inspectionId: 'insp-1',
    filename: 'a.pdf',
    mimeType: 'application/pdf',
    size: 1,
    storageKey: 'k',
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(inspectionService.getById).mockResolvedValue({ id: 'insp-1' } as any)
  })

  it('POST / returns 201 and DTO when upload succeeds', async () => {
    const createdAt = new Date('2026-06-01T10:00:00Z')
    const updatedAt = new Date('2026-06-01T10:00:01Z')
    vi.mocked(documentService.upload).mockResolvedValue({
      id: 'doc-1',
      inspectionId: 'insp-1',
      filename: 'note.txt',
      mimeType: 'text/plain',
      size: 2,
      storageKey: 'insp-1/k',
      metadata: { title: 'Note' },
      createdAt,
      updatedAt,
    })

    const form = new FormData()
    form.append('inspectionId', 'insp-1')
    form.append('file', new File(['hi'], 'note.txt', { type: 'text/plain' }))
    form.append('title', 'Note')

    const app = createTestApp()
    const res = await app.request('/', { method: 'POST', body: form })

    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({
      id: 'doc-1',
      inspectionId: 'insp-1',
      filename: 'note.txt',
      mimeType: 'text/plain',
      size: 2,
      metadata: { title: 'Note' },
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
    })
    expect(documentService.upload).toHaveBeenCalledWith(
      expect.any(File),
      expect.objectContaining({ inspectionId: 'insp-1', title: 'Note' }),
    )
  })

  it('POST / returns 413 when file exceeds limit', async () => {
    const big = new Uint8Array(MAX_DOCUMENT_UPLOAD_BYTES + 1)
    const form = new FormData()
    form.append('inspectionId', 'insp-1')
    form.append('file', new File([big], 'big.bin', { type: 'application/octet-stream' }))

    const app = createTestApp()
    const res = await app.request('/', { method: 'POST', body: form })

    expect(res.status).toBe(413)
    expect(documentService.upload).not.toHaveBeenCalled()
  })

  it('POST / returns 400 without file', async () => {
    const form = new FormData()
    form.append('inspectionId', 'insp-1')

    const app = createTestApp()
    const res = await app.request('/', { method: 'POST', body: form })

    expect(res.status).toBe(400)
    expect(documentService.upload).not.toHaveBeenCalled()
  })

  it('POST / returns 404 when inspection is missing', async () => {
    vi.mocked(inspectionService.getById).mockResolvedValue(null)

    const form = new FormData()
    form.append('inspectionId', 'insp-1')
    form.append('file', new File(['x'], 'a.txt', { type: 'text/plain' }))

    const app = createTestApp()
    const res = await app.request('/', { method: 'POST', body: form })

    expect(res.status).toBe(404)
    expect(documentService.upload).not.toHaveBeenCalled()
  })

  it('POST / returns 403 when inspection access is denied', async () => {
    vi.mocked(inspectionService.getById).mockRejectedValue(
      new Error('Unauthorized access to inspection'),
    )

    const form = new FormData()
    form.append('inspectionId', 'insp-1')
    form.append('file', new File(['x'], 'a.txt', { type: 'text/plain' }))

    const app = createTestApp()
    const res = await app.request('/', { method: 'POST', body: form })

    expect(res.status).toBe(403)
    expect(documentService.upload).not.toHaveBeenCalled()
  })

  it('POST / returns 400 when inspectionId is missing', async () => {
    const form = new FormData()
    form.append('file', new File(['x'], 'a.txt', { type: 'text/plain' }))

    const app = createTestApp()
    const res = await app.request('/', { method: 'POST', body: form })

    expect(res.status).toBe(400)
    expect(documentService.upload).not.toHaveBeenCalled()
  })

  it('POST / maps upload errors through mapError', async () => {
    vi.mocked(documentService.upload).mockRejectedValue(new Error('Document not found'))

    const form = new FormData()
    form.append('inspectionId', 'insp-1')
    form.append('file', new File(['x'], 'a.txt', { type: 'text/plain' }))

    const app = createTestApp()
    const res = await app.request('/', { method: 'POST', body: form })

    expect(res.status).toBe(404)
  })

  it('POST / returns 500 when upload fails with unexpected error', async () => {
    vi.mocked(documentService.upload).mockRejectedValue(new Error('storage unavailable'))

    const form = new FormData()
    form.append('inspectionId', 'insp-1')
    form.append('file', new File(['x'], 'a.txt', { type: 'text/plain' }))

    const app = createTestApp()
    const res = await app.request('/', { method: 'POST', body: form })

    expect(res.status).toBe(500)
  })

  it('POST / passes optional metadata fields when provided', async () => {
    const createdAt = new Date('2026-06-01T10:00:00Z')
    const updatedAt = new Date('2026-06-01T10:00:01Z')
    vi.mocked(documentService.upload).mockResolvedValue({
      id: 'doc-1',
      inspectionId: 'insp-1',
      filename: 'a.txt',
      mimeType: 'text/plain',
      size: 1,
      storageKey: 'k',
      metadata: { title: 'T', description: 'D', category: 'C' },
      createdAt,
      updatedAt,
    })

    const form = new FormData()
    form.append('inspectionId', 'insp-1')
    form.append('file', new File(['x'], 'a.txt', { type: 'text/plain' }))
    form.append('title', 'T')
    form.append('description', 'D')
    form.append('category', 'C')

    const app = createTestApp()
    const res = await app.request('/', { method: 'POST', body: form })

    expect(res.status).toBe(201)
    expect(documentService.upload).toHaveBeenCalledWith(expect.any(File), {
      inspectionId: 'insp-1',
      title: 'T',
      description: 'D',
      category: 'C',
    })
  })

  it('GET /:id/url returns signed URL payload', async () => {
    vi.mocked(documentService.getById).mockResolvedValue(sampleDoc)
    vi.mocked(documentService.getSignedUrl).mockResolvedValue('https://signed.example/get')

    const app = createTestApp()
    const res = await app.request('/doc-1/url')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      url: 'https://signed.example/get',
      expiresIn: DOCUMENT_SIGNED_URL_TTL_SECONDS,
    })
  })

  it('GET /:id/url returns 404 when document missing', async () => {
    vi.mocked(documentService.getById).mockResolvedValue(null)

    const app = createTestApp()
    const res = await app.request('/missing/url')

    expect(res.status).toBe(404)
    expect(documentService.getSignedUrl).not.toHaveBeenCalled()
  })

  it('GET /:id/url returns 404 when inspection row is missing', async () => {
    vi.mocked(documentService.getById).mockResolvedValue(sampleDoc)
    vi.mocked(inspectionService.getById).mockResolvedValue(null)

    const app = createTestApp()
    const res = await app.request('/doc-1/url')

    expect(res.status).toBe(404)
    expect(documentService.getSignedUrl).not.toHaveBeenCalled()
  })

  it('GET /:id/url returns 403 when inspection access is denied', async () => {
    vi.mocked(documentService.getById).mockResolvedValue(sampleDoc)
    vi.mocked(inspectionService.getById).mockRejectedValue(
      new Error('Unauthorized access to inspection'),
    )

    const app = createTestApp()
    const res = await app.request('/doc-1/url')

    expect(res.status).toBe(403)
    expect(documentService.getSignedUrl).not.toHaveBeenCalled()
  })

  it('GET /:id/url returns 404 when getSignedUrl reports not found', async () => {
    vi.mocked(documentService.getById).mockResolvedValue(sampleDoc)
    vi.mocked(documentService.getSignedUrl).mockRejectedValue(new Error('Document not found'))

    const app = createTestApp()
    const res = await app.request('/doc-1/url')

    expect(res.status).toBe(404)
  })

  it('GET /:id/url returns 500 when getSignedUrl fails unexpectedly', async () => {
    vi.mocked(documentService.getById).mockResolvedValue(sampleDoc)
    vi.mocked(documentService.getSignedUrl).mockRejectedValue(new Error('S3 unavailable'))

    const app = createTestApp()
    const res = await app.request('/doc-1/url')

    expect(res.status).toBe(500)
  })

  it('GET /:id/url returns 500 when inspection lookup throws non-auth error', async () => {
    vi.mocked(documentService.getById).mockResolvedValue(sampleDoc)
    vi.mocked(inspectionService.getById).mockRejectedValue(new Error('database down'))

    const app = createTestApp()
    const res = await app.request('/doc-1/url')

    expect(res.status).toBe(500)
  })

  it('DELETE /:id returns 204', async () => {
    vi.mocked(documentService.getById).mockResolvedValue(sampleDoc)
    vi.mocked(documentService.delete).mockResolvedValue(undefined)

    const app = createTestApp()
    const res = await app.request('/doc-1', { method: 'DELETE' })

    expect(res.status).toBe(204)
    expect(documentService.delete).toHaveBeenCalledWith('doc-1')
  })

  it('DELETE /:id returns 404 when inspection row is missing', async () => {
    vi.mocked(documentService.getById).mockResolvedValue(sampleDoc)
    vi.mocked(inspectionService.getById).mockResolvedValue(null)

    const app = createTestApp()
    const res = await app.request('/doc-1', { method: 'DELETE' })

    expect(res.status).toBe(404)
    expect(documentService.delete).not.toHaveBeenCalled()
  })

  it('DELETE /:id returns 403 when inspection access is denied', async () => {
    vi.mocked(documentService.getById).mockResolvedValue(sampleDoc)
    vi.mocked(inspectionService.getById).mockRejectedValue(
      new Error('Unauthorized access to inspection'),
    )

    const app = createTestApp()
    const res = await app.request('/doc-1', { method: 'DELETE' })

    expect(res.status).toBe(403)
    expect(documentService.delete).not.toHaveBeenCalled()
  })

  it('DELETE /:id returns 404 when delete reports not found', async () => {
    vi.mocked(documentService.getById).mockResolvedValue(sampleDoc)
    vi.mocked(documentService.delete).mockRejectedValue(new Error('Document not found'))

    const app = createTestApp()
    const res = await app.request('/doc-1', { method: 'DELETE' })

    expect(res.status).toBe(404)
  })

  it('DELETE /:id returns 500 when delete fails unexpectedly', async () => {
    vi.mocked(documentService.getById).mockResolvedValue(sampleDoc)
    vi.mocked(documentService.delete).mockRejectedValue(new Error('storage timeout'))

    const app = createTestApp()
    const res = await app.request('/doc-1', { method: 'DELETE' })

    expect(res.status).toBe(500)
  })

  it('DELETE /:id returns 500 when inspection lookup throws non-auth error', async () => {
    vi.mocked(documentService.getById).mockResolvedValue(sampleDoc)
    vi.mocked(inspectionService.getById).mockRejectedValue(new Error('database down'))

    const app = createTestApp()
    const res = await app.request('/doc-1', { method: 'DELETE' })

    expect(res.status).toBe(500)
  })
})
