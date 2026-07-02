import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { integrationDb as db } from '../../src/test-utils/integration-db.js'
import { inspectionDocumentDelegate } from '@codecomply/db'
import { MAX_DOCUMENT_UPLOAD_BYTES } from '../../src/routes/documents.js'

const ROUTE_USER = `doc-routes-user-${Date.now()}`

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
const getSignedGetUrl = vi.fn(async () => 'https://integration.example/signed-doc')

vi.mock('../../src/lib/storage/storage-client.js', () => ({
  createObjectStorageClientFromEnv: vi.fn(() => ({
    putObject,
    deleteObject,
    getSignedGetUrl,
  })),
}))

const { app } = await import('../../src/app.js')

describe.sequential('Document HTTP routes (M7-S9)', () => {
  let inspectionId: string
  let permitId: string

  beforeAll(async () => {
    await inspectionDocumentDelegate.deleteMany({
      where: { inspection: { notes: 'M7-S9 document routes integration' } },
    })
    await db.inspectionSchedule.deleteMany({
      where: { inspection: { notes: 'M7-S9 document routes integration' } },
    })
    await db.permitInspection.deleteMany({
      where: { notes: 'M7-S9 document routes integration' },
    })
    await db.permit.deleteMany({
      where: { address: 'M7-S9 document routes integration address' },
    })
    await db.user.deleteMany({ where: { id: ROUTE_USER } })

    await db.user.create({
      data: {
        id: ROUTE_USER,
        email: `m7-s9-doc-${Date.now()}@example.com`,
        name: 'M7 S9 Doc Routes',
        role: 'SCO',
      },
    })

    const permit = await db.permit.create({
      data: {
        permitNumber: `M7-S9-RT-${Date.now()}`,
        address: 'M7-S9 document routes integration address',
        scope: 'Test',
      },
    })
    permitId = permit.id

    const inspection = await db.permitInspection.create({
      data: {
        permitId,
        scheduledDate: new Date('2026-09-15'),
        status: 'IN_PROGRESS',
        notes: 'M7-S9 document routes integration',
      },
    })
    inspectionId = inspection.id

    await db.inspectionSchedule.create({
      data: { inspectionId, assignedToId: ROUTE_USER },
    })
  })

  afterAll(async () => {
    await inspectionDocumentDelegate.deleteMany({ where: { inspectionId } })
    await db.inspectionSchedule.deleteMany({ where: { inspectionId } })
    await db.permitInspection.deleteMany({ where: { id: inspectionId } })
    await db.permit.deleteMany({ where: { id: permitId } })
    await db.user.deleteMany({ where: { id: ROUTE_USER } })
  })

  it('POST /api/documents uploads, GET url returns signed payload, GET inspection documents lists, DELETE removes', async () => {
    putObject.mockClear()
    getSignedGetUrl.mockClear()
    deleteObject.mockClear()

    const form = new FormData()
    form.append('inspectionId', inspectionId)
    form.append('title', 'Permit scan')
    form.append(
      'file',
      new File([new TextEncoder().encode('pdf-bytes')], 'permit.pdf', {
        type: 'application/pdf',
      }),
    )

    const post = await app.request('/api/documents', { method: 'POST', body: form })
    expect(post.status).toBe(201)
    const created = (await post.json()) as { id: string; inspectionId: string; filename: string }
    expect(created.inspectionId).toBe(inspectionId)
    expect(created.filename).toBe('permit.pdf')
    expect(putObject).toHaveBeenCalled()

    const urlRes = await app.request(`/api/documents/${created.id}/url`)
    expect(urlRes.status).toBe(200)
    const urlJson = (await urlRes.json()) as { url: string; expiresIn: number }
    expect(urlJson.url).toBe('https://integration.example/signed-doc')
    expect(urlJson.expiresIn).toBeGreaterThan(0)
    expect(getSignedGetUrl).toHaveBeenCalled()

    const list = await app.request(`/api/inspections/${inspectionId}/documents`)
    expect(list.status).toBe(200)
    const docs = (await list.json()) as { id: string }[]
    expect(docs.some((d) => d.id === created.id)).toBe(true)

    const del = await app.request(`/api/documents/${created.id}`, { method: 'DELETE' })
    expect(del.status).toBe(204)
    expect(deleteObject).toHaveBeenCalled()

    const gone = await inspectionDocumentDelegate.findUnique({ where: { id: created.id } })
    expect(gone).toBeNull()
  })

  it('POST /api/documents returns 413 when file is too large', async () => {
    const form = new FormData()
    form.append('inspectionId', inspectionId)
    form.append(
      'file',
      new File([new Uint8Array(MAX_DOCUMENT_UPLOAD_BYTES + 1)], 'huge.bin', {
        type: 'application/octet-stream',
      }),
    )

    const post = await app.request('/api/documents', { method: 'POST', body: form })
    expect(post.status).toBe(413)
  })
})
