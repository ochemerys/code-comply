import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Hono } from 'hono'
import photosRoutes, { MAX_PHOTO_UPLOAD_BYTES } from './photos.js'
import { photoService } from '../services/photo.service.js'

vi.mock('../services/photo.service.js', () => ({
  photoService: {
    upload: vi.fn(),
    deleteByLookup: vi.fn(),
  },
  MAX_PHOTO_UPLOAD_BYTES: 10 * 1024 * 1024,
}))

const createTestApp = () => {
  const testApp = new Hono<{ Variables: { userId: string } }>()
  testApp.use('*', async (c, next) => {
    c.set('userId', 'user-123')
    await next()
  })
  testApp.route('/', photosRoutes)
  return testApp
}

describe('Photos routes (M7-S19)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('POST / returns 201 when upload creates a new photo', async () => {
    const createdAt = new Date('2026-06-01T10:00:00Z')
    const syncedAt = new Date('2026-06-01T10:00:01Z')
    vi.mocked(photoService.upload).mockResolvedValue({
      created: true,
      photo: {
        id: 'ph-1',
        clientId: 'c1',
        inspectionId: 'insp-1',
        deficiencyId: null,
        filename: 'shot.jpg',
        mimeType: 'image/jpeg',
        size: 4,
        storageKey: 'insp-1/k',
        metadata: { checklistItemId: 'item-1' },
        annotations: null,
        createdAt,
        syncedAt,
      },
    })

    const form = new FormData()
    form.append('inspectionId', 'insp-1')
    form.append('clientId', 'c1')
    form.append('metadata', JSON.stringify({ a: 1 }))
    form.append(
      'file',
      new File([new Uint8Array([1, 2, 3, 4])], 'shot.jpg', { type: 'image/jpeg' }),
    )

    const app = createTestApp()
    const res = await app.request('/', { method: 'POST', body: form })

    expect(res.status).toBe(201)
    const json = (await res.json()) as { id: string; storageKey: string }
    expect(json.id).toBe('ph-1')
    expect(json.storageKey).toBe('insp-1/k')
    expect(photoService.upload).toHaveBeenCalled()
  })

  it('POST / returns 200 when upload is idempotent', async () => {
    vi.mocked(photoService.upload).mockResolvedValue({
      created: false,
      photo: {
        id: 'ph-1',
        clientId: 'c1',
        inspectionId: 'insp-1',
        deficiencyId: null,
        filename: 'shot.jpg',
        mimeType: 'image/jpeg',
        size: 4,
        storageKey: 'k',
        metadata: {},
        annotations: null,
        createdAt: new Date(),
        syncedAt: new Date(),
      },
    })

    const form = new FormData()
    form.append('inspectionId', 'insp-1')
    form.append('clientId', 'c1')
    form.append('file', new File([new Uint8Array([1])], 'shot.jpg'))

    const app = createTestApp()
    const res = await app.request('/', { method: 'POST', body: form })
    expect(res.status).toBe(200)
  })

  it('POST / returns 413 when file exceeds limit', async () => {
    const big = new Uint8Array(MAX_PHOTO_UPLOAD_BYTES + 1)
    const form = new FormData()
    form.append('inspectionId', 'insp-1')
    form.append('clientId', 'c1')
    form.append('file', new File([big], 'huge.jpg', { type: 'image/jpeg' }))

    const app = createTestApp()
    const res = await app.request('/', { method: 'POST', body: form })
    expect(res.status).toBe(413)
    expect(photoService.upload).not.toHaveBeenCalled()
  })

  it('DELETE /:id returns 204', async () => {
    vi.mocked(photoService.deleteByLookup).mockResolvedValue(undefined)

    const app = createTestApp()
    const res = await app.request('/ph-1?clientId=c1', { method: 'DELETE' })

    expect(res.status).toBe(204)
    expect(photoService.deleteByLookup).toHaveBeenCalledWith('ph-1', 'c1', 'user-123')
  })
})
