import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { inspectionDocumentDelegate } from '@codecomply/db'
import { integrationDb as db } from '../../src/test-utils/integration-db.js'
import { DocumentService } from '../../src/services/document.service.js'
import type { ObjectStorageClient } from '../../src/lib/storage/storage-client.js'

describe.sequential('DocumentService integration (M7-S8)', () => {
  let inspectionId: string
  let service: DocumentService
  const putObject = vi.fn(
    async (_kind: 'photos' | 'documents', _key: string, _body: Buffer, _ct?: string) => {},
  )
  const deleteObject = vi.fn(async (_kind: 'photos' | 'documents', _key: string) => {})
  const getSignedGetUrl = vi.fn(
    async (_kind: 'photos' | 'documents', _key: string, _exp: number) => {
      return 'https://integration.example/signed'
    },
  )

  beforeAll(async () => {
    const inspection = await db.permitInspection.create({
      data: {
        scheduledDate: new Date('2026-09-01'),
        status: 'IN_PROGRESS',
        notes: 'M7-S8 document service integration',
      },
    })
    inspectionId = inspection.id

    const storage = {
      putObject: (kind: 'photos' | 'documents', key: string, body: Buffer, ct?: string) =>
        putObject(kind, key, body, ct),
      deleteObject: (kind: 'photos' | 'documents', key: string) => deleteObject(kind, key),
      getSignedGetUrl: (kind: 'photos' | 'documents', key: string, exp: number) =>
        getSignedGetUrl(kind, key, exp),
    } as unknown as ObjectStorageClient

    service = new DocumentService(storage)
  })

  afterAll(async () => {
    await inspectionDocumentDelegate.deleteMany({ where: { inspectionId } })
    await db.permitInspection.deleteMany({ where: { id: inspectionId } })
  })

  it('upload writes to storage and creates a row', async () => {
    putObject.mockClear()
    const file = new File([new TextEncoder().encode('hello')], 'memo.txt', { type: 'text/plain' })
    const doc = await service.upload(file, {
      inspectionId,
      title: 'Site memo',
    })

    expect(putObject).toHaveBeenCalledWith(
      'documents',
      expect.stringContaining(`${inspectionId}/`),
      expect.any(Buffer),
      'text/plain',
    )

    const row = await inspectionDocumentDelegate.findUniqueOrThrow({ where: { id: doc.id } })
    expect(row.filename).toBe('memo.txt')
    expect(row.metadata).toEqual({ title: 'Site memo' })
    expect(row.size).toBe(5)
  })

  it('getSignedUrl uses storage key from the row', async () => {
    getSignedGetUrl.mockClear()
    const file = new File([new Uint8Array([1])], 'x.bin', { type: 'application/octet-stream' })
    const doc = await service.upload(file, { inspectionId })

    const url = await service.getSignedUrl(doc.id)
    expect(url).toBe('https://integration.example/signed')
    expect(getSignedGetUrl).toHaveBeenCalledWith('documents', doc.storageKey, expect.any(Number))
  })

  it('delete removes object then row', async () => {
    deleteObject.mockClear()
    const file = new File([new Uint8Array([2])], 'to-delete.txt', { type: 'text/plain' })
    const doc = await service.upload(file, { inspectionId })

    await service.delete(doc.id)

    expect(deleteObject).toHaveBeenCalledWith('documents', doc.storageKey)
    const gone = await inspectionDocumentDelegate.findUnique({ where: { id: doc.id } })
    expect(gone).toBeNull()
  })

  it('getByInspection returns all documents for inspection', async () => {
    const a = await service.upload(
      new File([new Uint8Array([1])], 'a.txt', { type: 'text/plain' }),
      { inspectionId },
    )
    const b = await service.upload(
      new File([new Uint8Array([2])], 'b.txt', { type: 'text/plain' }),
      { inspectionId },
    )

    const list = await service.getByInspection(inspectionId)
    const ids = new Set(list.map((d) => d.id))
    expect(ids.has(a.id)).toBe(true)
    expect(ids.has(b.id)).toBe(true)
    expect(list.length).toBeGreaterThanOrEqual(2)
  })
})
