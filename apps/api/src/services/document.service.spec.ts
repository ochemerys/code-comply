import { describe, it, expect, beforeEach, vi } from 'vitest'
import { DocumentService, DOCUMENT_SIGNED_URL_TTL_SECONDS } from './document.service'
import { inspectionDocumentDelegate } from '@codecomply/db'
import type { ObjectStorageClient } from '../lib/storage/storage-client'

vi.mock('@codecomply/db', () => ({
  inspectionDocumentDelegate: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    delete: vi.fn(),
  },
}))

function mockStorage(): ObjectStorageClient {
  return {
    putObject: vi.fn().mockResolvedValue(undefined),
    deleteObject: vi.fn().mockResolvedValue(undefined),
    getSignedGetUrl: vi.fn().mockResolvedValue('https://example.com/signed'),
  } as unknown as ObjectStorageClient
}

describe('DocumentService', () => {
  let storage: ObjectStorageClient
  let service: DocumentService

  beforeEach(() => {
    vi.clearAllMocks()
    storage = mockStorage()
    service = new DocumentService(storage)
  })

  describe('upload', () => {
    it('stores file in object storage and persists metadata', async () => {
      const createdAt = new Date('2026-04-01T12:00:00Z')
      const updatedAt = new Date('2026-04-01T12:00:01Z')
      vi.mocked(inspectionDocumentDelegate.create).mockResolvedValue({
        id: 'doc-1',
        inspectionId: 'insp-1',
        filename: 'report.pdf',
        mimeType: 'application/pdf',
        size: 4,
        storageKey: 'insp-1/uuid-report.pdf',
        metadata: { title: 'Notice' },
        createdAt,
        updatedAt,
      } as any)

      const file = new File([new Uint8Array([1, 2, 3, 4])], 'report.pdf', {
        type: 'application/pdf',
      })
      const doc = await service.upload(file, {
        inspectionId: 'insp-1',
        title: 'Notice',
      })

      expect(vi.mocked(storage.putObject)).toHaveBeenCalledWith(
        'documents',
        expect.stringMatching(/^insp-1\/[a-f0-9-]{36}-report\.pdf$/),
        expect.any(Buffer),
        'application/pdf',
      )
      expect(inspectionDocumentDelegate.create).toHaveBeenCalledWith({
        data: {
          inspectionId: 'insp-1',
          filename: 'report.pdf',
          mimeType: 'application/pdf',
          size: 4,
          storageKey: expect.stringMatching(/^insp-1\/[a-f0-9-]{36}-report\.pdf$/),
          metadata: { title: 'Notice' },
        },
      })
      expect(doc.id).toBe('doc-1')
      expect(doc.metadata).toEqual({ title: 'Notice' })
    })

    it('throws when inspectionId is missing', async () => {
      const file = new File([new Uint8Array([1])], 'x.txt')
      await expect(service.upload(file, { inspectionId: '' })).rejects.toThrow(/inspectionId/)
      expect(storage.putObject).not.toHaveBeenCalled()
    })

    it('sanitizes path-like filenames to a single basename', async () => {
      vi.mocked(inspectionDocumentDelegate.create).mockResolvedValue({
        id: 'd',
        inspectionId: 'i',
        filename: '..\\..\\deep\\notice.pdf',
        mimeType: 'application/pdf',
        size: 1,
        storageKey: 'i/k-notice.pdf',
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)

      const file = new File([new Uint8Array([1])], '..\\..\\deep\\notice.pdf', {
        type: 'application/pdf',
      })
      await service.upload(file, { inspectionId: 'i' })

      expect(vi.mocked(storage.putObject)).toHaveBeenCalledWith(
        'documents',
        expect.stringMatching(/-notice\.pdf$/),
        expect.any(Buffer),
        'application/pdf',
      )
    })

    it('falls back to upload when filename sanitizes to empty', async () => {
      vi.mocked(inspectionDocumentDelegate.create).mockResolvedValue({
        id: 'd',
        inspectionId: 'i',
        filename: '///',
        mimeType: 'application/octet-stream',
        size: 1,
        storageKey: 'i/k-upload',
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)

      const file = new File([new Uint8Array([1])], '///')
      await service.upload(file, { inspectionId: 'i' })
      expect(vi.mocked(storage.putObject)).toHaveBeenCalledWith(
        'documents',
        expect.stringMatching(/-upload$/),
        expect.any(Buffer),
        'application/octet-stream',
      )
    })

    it('uses application/octet-stream when file has no type', async () => {
      const file = new File([new Uint8Array([1])], 'blob.bin')
      Object.defineProperty(file, 'type', { value: '' })
      vi.mocked(inspectionDocumentDelegate.create).mockResolvedValue({
        id: 'd',
        inspectionId: 'i',
        filename: 'blob.bin',
        mimeType: 'application/octet-stream',
        size: 1,
        storageKey: 'i/k-blob.bin',
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)

      await service.upload(file, { inspectionId: 'i' })

      expect(vi.mocked(storage.putObject)).toHaveBeenCalledWith(
        'documents',
        expect.any(String),
        expect.any(Buffer),
        'application/octet-stream',
      )
    })
  })

  describe('getSignedUrl', () => {
    it('returns a presigned URL from storage', async () => {
      vi.mocked(inspectionDocumentDelegate.findUnique).mockResolvedValue({
        id: 'doc-1',
        inspectionId: 'insp-1',
        storageKey: 'insp-1/key-1',
        filename: 'a.pdf',
        mimeType: 'application/pdf',
        size: 1,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)

      const url = await service.getSignedUrl('doc-1')
      expect(url).toBe('https://example.com/signed')
      expect(vi.mocked(storage.getSignedGetUrl)).toHaveBeenCalledWith(
        'documents',
        'insp-1/key-1',
        DOCUMENT_SIGNED_URL_TTL_SECONDS,
      )
    })

    it('throws when document does not exist', async () => {
      vi.mocked(inspectionDocumentDelegate.findUnique).mockResolvedValue(null)
      await expect(service.getSignedUrl('missing')).rejects.toThrow(/not found/)
    })
  })

  describe('delete', () => {
    it('removes object from storage then deletes the row', async () => {
      vi.mocked(inspectionDocumentDelegate.findUnique).mockResolvedValue({
        id: 'doc-1',
        inspectionId: 'insp-1',
        storageKey: 'insp-1/key-1',
        filename: 'a.pdf',
        mimeType: 'application/pdf',
        size: 1,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)

      await service.delete('doc-1')

      expect(vi.mocked(storage.deleteObject)).toHaveBeenCalledWith('documents', 'insp-1/key-1')
      expect(inspectionDocumentDelegate.delete).toHaveBeenCalledWith({ where: { id: 'doc-1' } })
    })

    it('throws when document does not exist', async () => {
      vi.mocked(inspectionDocumentDelegate.findUnique).mockResolvedValue(null)
      await expect(service.delete('missing')).rejects.toThrow(/not found/)
      expect(storage.deleteObject).not.toHaveBeenCalled()
    })
  })

  describe('getById', () => {
    it('returns domain document when row exists', async () => {
      const createdAt = new Date('2026-04-01T12:00:00Z')
      const updatedAt = new Date('2026-04-01T12:00:01Z')
      vi.mocked(inspectionDocumentDelegate.findUnique).mockResolvedValue({
        id: 'doc-1',
        inspectionId: 'insp-1',
        filename: 'a.pdf',
        mimeType: 'application/pdf',
        size: 9,
        storageKey: 'insp-1/k',
        metadata: { title: 'T' },
        createdAt,
        updatedAt,
      } as any)

      const doc = await service.getById('doc-1')
      expect(doc).toEqual({
        id: 'doc-1',
        inspectionId: 'insp-1',
        filename: 'a.pdf',
        mimeType: 'application/pdf',
        size: 9,
        storageKey: 'insp-1/k',
        metadata: { title: 'T' },
        createdAt,
        updatedAt,
      })
    })

    it('returns null when row is missing', async () => {
      vi.mocked(inspectionDocumentDelegate.findUnique).mockResolvedValue(null)
      await expect(service.getById('missing')).resolves.toBeNull()
    })
  })

  describe('getByInspection', () => {
    it('returns documents ordered by createdAt desc', async () => {
      const t1 = new Date('2026-01-02')
      const t2 = new Date('2026-01-01')
      vi.mocked(inspectionDocumentDelegate.findMany).mockResolvedValue([
        {
          id: 'b',
          inspectionId: 'insp-1',
          filename: 'second.pdf',
          mimeType: 'application/pdf',
          size: 1,
          storageKey: 'k2',
          metadata: {},
          createdAt: t1,
          updatedAt: t1,
        },
        {
          id: 'a',
          inspectionId: 'insp-1',
          filename: 'first.pdf',
          mimeType: 'application/pdf',
          size: 1,
          storageKey: 'k1',
          metadata: { category: 'x' },
          createdAt: t2,
          updatedAt: t2,
        },
      ] as any)

      const list = await service.getByInspection('insp-1')
      expect(inspectionDocumentDelegate.findMany).toHaveBeenCalledWith({
        where: { inspectionId: 'insp-1' },
        orderBy: { createdAt: 'desc' },
      })
      expect(list).toHaveLength(2)
      expect(list[0].id).toBe('b')
      expect(list[1].metadata).toEqual({ category: 'x' })
    })

    it('maps non-object metadata JSON to an empty object', async () => {
      vi.mocked(inspectionDocumentDelegate.findMany).mockResolvedValue([
        {
          id: 'x',
          inspectionId: 'insp-1',
          filename: 'a.pdf',
          mimeType: 'application/pdf',
          size: 1,
          storageKey: 'k',
          metadata: ['bad'] as unknown as object,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ] as any)

      const list = await service.getByInspection('insp-1')
      expect(list[0].metadata).toEqual({})
    })
  })
})
