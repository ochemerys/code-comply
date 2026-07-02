import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { integrationDb as db } from '../../src/test-utils/integration-db.js'
import { PhotoService } from '../../src/services/photo.service.js'
import type { ObjectStorageClient } from '../../src/lib/storage/storage-client.js'

describe.sequential('PhotoService integration (M7-S19)', () => {
  let inspectionId: string
  let userId: string
  let service: PhotoService
  const putObject = vi.fn(
    async (_kind: 'photos' | 'documents', _key: string, _body: Buffer, _ct?: string) => {},
  )
  const deleteObject = vi.fn(async (_kind: 'photos' | 'documents', _key: string) => {})

  beforeAll(async () => {
    userId = `photo-svc-user-${Date.now()}`
    await db.user.create({
      data: {
        id: userId,
        email: `m7-s19-photo-svc-${Date.now()}@example.com`,
        name: 'Photo Svc Int',
        role: 'SCO',
      },
    })

    const inspection = await db.permitInspection.create({
      data: {
        scheduledDate: new Date('2026-10-01'),
        status: 'IN_PROGRESS',
        notes: 'M7-S19 photo service integration',
      },
    })
    inspectionId = inspection.id

    await db.inspectionSchedule.create({
      data: { inspectionId, assignedToId: userId },
    })

    const storage = {
      putObject: (kind: 'photos' | 'documents', key: string, body: Buffer, ct?: string) =>
        putObject(kind, key, body, ct),
      deleteObject: (kind: 'photos' | 'documents', key: string) => deleteObject(kind, key),
    } as unknown as ObjectStorageClient

    service = new PhotoService(storage)
  })

  afterAll(async () => {
    await db.photo.deleteMany({ where: { inspectionId } })
    await db.inspectionSchedule.deleteMany({ where: { inspectionId } })
    await db.permitInspection.deleteMany({ where: { id: inspectionId } })
    await db.user.deleteMany({ where: { id: userId } })
  })

  it('upload writes to photos bucket and creates Photo row', async () => {
    putObject.mockClear()
    const file = new File([new TextEncoder().encode('img')], 'evidence.jpg', {
      type: 'image/jpeg',
    })

    const { photo, created } = await service.upload(
      file,
      {
        clientId: `client-${Date.now()}-a`,
        inspectionId,
        metadata: { permitNumber: 'P-1' },
      },
      userId,
    )

    expect(created).toBe(true)
    expect(photo.storageKey).toContain(inspectionId)
    expect(putObject).toHaveBeenCalledWith(
      'photos',
      expect.stringContaining(inspectionId),
      expect.any(Buffer),
      'image/jpeg',
    )

    const row = await db.photo.findUniqueOrThrow({ where: { id: photo.id } })
    expect(row.clientId).toBe(photo.clientId)
    expect(row.inspectionId).toBe(inspectionId)
  })

  it('second upload with same clientId is idempotent', async () => {
    const clientId = `client-${Date.now()}-idem`
    const f1 = new File([new Uint8Array([1])], 'a.jpg', { type: 'image/jpeg' })
    const first = await service.upload(f1, { clientId, inspectionId, metadata: {} }, userId)
    putObject.mockClear()

    const f2 = new File([new Uint8Array([2, 2])], 'b.jpg', { type: 'image/jpeg' })
    const second = await service.upload(f2, { clientId, inspectionId, metadata: {} }, userId)

    expect(second.created).toBe(false)
    expect(second.photo.id).toBe(first.photo.id)
    expect(putObject).not.toHaveBeenCalled()
  })

  it('deleteByLookup removes storage object and row', async () => {
    deleteObject.mockClear()
    const clientId = `client-${Date.now()}-del`
    const file = new File([new Uint8Array([3])], 'd.jpg', { type: 'image/jpeg' })
    const { photo } = await service.upload(file, { clientId, inspectionId, metadata: {} }, userId)

    await service.deleteByLookup(photo.id, undefined, userId)

    expect(deleteObject).toHaveBeenCalledWith('photos', photo.storageKey)
    const gone = await db.photo.findUnique({ where: { id: photo.id } })
    expect(gone).toBeNull()
  })

  it('deleteByLookup with only clientId finds row', async () => {
    const clientId = `client-${Date.now()}-q`
    const file = new File([new Uint8Array([4])], 'q.jpg', { type: 'image/jpeg' })
    const { photo } = await service.upload(file, { clientId, inspectionId, metadata: {} }, userId)

    await service.deleteByLookup('not-a-server-id', clientId, userId)

    const gone = await db.photo.findUnique({ where: { id: photo.id } })
    expect(gone).toBeNull()
  })
})
