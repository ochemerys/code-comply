import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { integrationDb as db } from '../../src/test-utils/integration-db.js'

const ROUTE_USER = `photo-routes-user-${Date.now()}`

vi.mock('../../src/middleware/auth.middleware.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/middleware/auth.middleware.js')>()
  return {
    ...actual,
    authMiddleware: vi.fn(
      async (c: { set: (k: string, v: string) => void }, next: () => Promise<void>) => {
        c.set('userId', ROUTE_USER)
        await next()
      },
    ),
  }
})

const putObject = vi.fn(async () => {})
const deleteObject = vi.fn(async () => {})

vi.mock('../../src/lib/storage/storage-client.js', () => ({
  createObjectStorageClientFromEnv: vi.fn(() => ({
    putObject,
    deleteObject,
    getSignedGetUrl: vi.fn(),
  })),
}))

const { app } = await import('../../src/app.js')

describe.sequential('Photo HTTP routes (M7-S19)', () => {
  let inspectionId: string
  let permitId: string

  beforeAll(async () => {
    await db.photo.deleteMany({
      where: { inspection: { notes: 'M7-S19 photo routes integration' } },
    })
    await db.inspectionSchedule.deleteMany({
      where: { inspection: { notes: 'M7-S19 photo routes integration' } },
    })
    await db.permitInspection.deleteMany({
      where: { notes: 'M7-S19 photo routes integration' },
    })
    await db.permit.deleteMany({
      where: { address: 'M7-S19 photo routes integration address' },
    })
    await db.user.deleteMany({ where: { id: ROUTE_USER } })

    await db.user.create({
      data: {
        id: ROUTE_USER,
        email: `m7-s19-photo-rt-${Date.now()}@example.com`,
        name: 'M7 S19 Photo Routes',
        role: 'SCO',
      },
    })

    const permit = await db.permit.create({
      data: {
        permitNumber: `M7-S19-PH-${Date.now()}`,
        address: 'M7-S19 photo routes integration address',
        scope: 'Test',
      },
    })
    permitId = permit.id

    const inspection = await db.permitInspection.create({
      data: {
        permitId,
        scheduledDate: new Date('2026-09-15'),
        status: 'IN_PROGRESS',
        notes: 'M7-S19 photo routes integration',
      },
    })
    inspectionId = inspection.id

    await db.inspectionSchedule.create({
      data: { inspectionId, assignedToId: ROUTE_USER },
    })
  })

  afterAll(async () => {
    await db.photo.deleteMany({ where: { inspectionId } })
    await db.inspectionSchedule.deleteMany({ where: { inspectionId } })
    await db.permitInspection.deleteMany({ where: { id: inspectionId } })
    await db.permit.deleteMany({ where: { id: permitId } })
    await db.user.deleteMany({ where: { id: ROUTE_USER } })
  })

  it('POST /api/photos uploads then DELETE removes', async () => {
    putObject.mockClear()
    deleteObject.mockClear()

    const clientId = `e2e-photo-${Date.now()}`
    const form = new FormData()
    form.append('inspectionId', inspectionId)
    form.append('clientId', clientId)
    form.append('metadata', JSON.stringify({ source: 'integration' }))
    form.append(
      'file',
      new File([new TextEncoder().encode('bytes')], 'wall.jpg', { type: 'image/jpeg' }),
    )

    const post = await app.request('/api/photos', { method: 'POST', body: form })
    expect(post.status).toBe(201)
    const created = (await post.json()) as { id: string; storageKey?: string }
    expect(created.id).toBeTruthy()
    expect(putObject).toHaveBeenCalled()

    const del = await app.request(`/api/photos/${encodeURIComponent(created.id)}`, {
      method: 'DELETE',
    })
    expect(del.status).toBe(204)
    expect(deleteObject).toHaveBeenCalled()

    const row = await db.photo.findUnique({ where: { id: created.id } })
    expect(row).toBeNull()
  })

  it('POST with duplicate clientId returns 200 and does not write twice', async () => {
    putObject.mockClear()
    const clientId = `dup-${Date.now()}`

    const mkForm = () => {
      const form = new FormData()
      form.append('inspectionId', inspectionId)
      form.append('clientId', clientId)
      form.append('metadata', '{}')
      form.append('file', new File([new Uint8Array([1])], 'a.jpg', { type: 'image/jpeg' }))
      return form
    }

    const first = await app.request('/api/photos', { method: 'POST', body: mkForm() })
    expect(first.status).toBe(201)

    const second = await app.request('/api/photos', { method: 'POST', body: mkForm() })
    expect(second.status).toBe(200)
    expect(putObject).toHaveBeenCalledTimes(1)
  })
})
