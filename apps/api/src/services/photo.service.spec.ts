import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PhotoService, MAX_PHOTO_UPLOAD_BYTES } from './photo.service.js'
import { prisma } from '@codecomply/db'
import { inspectionService } from './inspection.service.js'

vi.mock('@codecomply/db', () => ({
  prisma: {
    photo: {
      findUnique: vi.fn(),
      create: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    deficiency: {
      findFirst: vi.fn(),
    },
  },
}))

vi.mock('./inspection.service.js', () => ({
  inspectionService: {
    getById: vi.fn(),
  },
}))

vi.mock('./audit-log.service.js', () => ({
  AUDIT_ACTION: { PHOTO_ADDED: 'PHOTO_ADDED' },
  AUDIT_ENTITY: { PERMIT_INSPECTION: 'PermitInspection' },
  auditLogService: {
    append: vi.fn().mockResolvedValue({ id: 'audit-1' }),
  },
}))

describe('PhotoService', () => {
  const putObject = vi.fn(async () => {})
  const deleteObject = vi.fn(async () => {})
  const service = new PhotoService({
    putObject,
    deleteObject,
  } as any)

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(inspectionService.getById).mockResolvedValue({ id: 'insp-1' } as any)
  })

  it('upload creates row and stores bytes when clientId is new', async () => {
    vi.mocked(prisma.deficiency.findFirst).mockResolvedValue(null)
    // Upsert creates a new row without storageKey
    vi.mocked(prisma.photo.upsert).mockResolvedValue({
      id: 'srv-1',
      clientId: 'c1',
      inspectionId: 'insp-1',
      deficiencyId: null,
      filename: 'a.jpg',
      mimeType: 'image/jpeg',
      size: 0,
      storageKey: null,
      metadata: { x: 1 },
      annotations: null,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      syncedAt: null,
    } as any)
    // Update adds the storageKey after upload
    vi.mocked(prisma.photo.update).mockResolvedValue({
      id: 'srv-1',
      clientId: 'c1',
      inspectionId: 'insp-1',
      deficiencyId: null,
      filename: 'a.jpg',
      mimeType: 'image/jpeg',
      size: 3,
      storageKey: 'insp-1/key',
      metadata: { x: 1 },
      annotations: null,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      syncedAt: new Date('2026-01-01T00:00:01Z'),
    } as any)

    const file = new File([new Uint8Array([1, 2, 3])], 'a.jpg', { type: 'image/jpeg' })
    const out = await service.upload(
      file,
      { clientId: 'c1', inspectionId: 'insp-1', metadata: { x: 1 } },
      'user-1',
    )

    expect(out.created).toBe(true)
    expect(out.photo.id).toBe('srv-1')
    expect(putObject).toHaveBeenCalledWith(
      'photos',
      expect.stringContaining('insp-1/'),
      expect.any(Buffer),
      'image/jpeg',
    )
    expect(prisma.photo.upsert).toHaveBeenCalled()
    expect(prisma.photo.update).toHaveBeenCalled()
  })

  it('upload is idempotent when clientId already exists for same inspection', async () => {
    const existing = {
      id: 'existing',
      clientId: 'c1',
      inspectionId: 'insp-1',
      deficiencyId: null,
      filename: 'a.jpg',
      mimeType: 'image/jpeg',
      size: 3,
      storageKey: 'k',
      metadata: {},
      annotations: null,
      createdAt: new Date(),
      syncedAt: new Date(),
    }
    // Upsert returns existing row with storageKey
    vi.mocked(prisma.photo.upsert).mockResolvedValue(existing as any)

    const file = new File([new Uint8Array([9])], 'a.jpg', { type: 'image/jpeg' })
    const out = await service.upload(
      file,
      { clientId: 'c1', inspectionId: 'insp-1', metadata: {} },
      'user-1',
    )

    expect(out.created).toBe(false)
    expect(out.photo.id).toBe('existing')
    expect(putObject).not.toHaveBeenCalled()
    expect(prisma.photo.update).not.toHaveBeenCalled()
  })

  it('upload rejects when clientId belongs to another inspection', async () => {
    vi.mocked(prisma.photo.upsert).mockResolvedValue({
      id: 'x',
      clientId: 'c1',
      inspectionId: 'other',
      storageKey: 'k',
    } as any)

    const file = new File([new Uint8Array([1])], 'a.jpg')
    await expect(
      service.upload(file, { clientId: 'c1', inspectionId: 'insp-1', metadata: {} }, 'user-1'),
    ).rejects.toThrow(/already exists/)
  })

  it('upload validates deficiency belongs to inspection', async () => {
    vi.mocked(prisma.deficiency.findFirst).mockResolvedValue(null)

    const file = new File([new Uint8Array([1])], 'a.jpg')
    await expect(
      service.upload(
        file,
        {
          clientId: 'c1',
          inspectionId: 'insp-1',
          deficiencyId: 'def-bad',
          metadata: {},
        },
        'user-1',
      ),
    ).rejects.toThrow(/Deficiency not found/)
  })

  it('deleteByLookup removes object and row when photo exists', async () => {
    vi.mocked(prisma.photo.findUnique).mockResolvedValue({
      id: 'ph-1',
      inspectionId: 'insp-1',
      storageKey: 'sk',
    } as any)

    vi.mocked(prisma.photo.delete).mockResolvedValue({} as any)

    await service.deleteByLookup('ph-1', undefined, 'user-1')

    expect(deleteObject).toHaveBeenCalledWith('photos', 'sk')
    expect(prisma.photo.delete).toHaveBeenCalledWith({ where: { id: 'ph-1' } })
  })

  it('deleteByLookup is no-op when photo missing', async () => {
    vi.mocked(prisma.photo.findUnique).mockResolvedValue(null)

    await service.deleteByLookup('nope', 'c1', 'user-1')

    expect(deleteObject).not.toHaveBeenCalled()
    expect(prisma.photo.delete).not.toHaveBeenCalled()
  })

  it('exports upload size limit aligned with route', () => {
    expect(MAX_PHOTO_UPLOAD_BYTES).toBe(10 * 1024 * 1024)
  })
})
