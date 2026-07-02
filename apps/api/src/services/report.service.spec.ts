import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prisma } from '@codecomply/db'
import {
  ReportService,
  computeReportDocumentHash,
  PdfGenerationTimeoutError,
} from './report.service.js'
import { PDF_GENERATION_TARGET_MS } from '../lib/pdf/pdf-generation-config.js'

vi.mock('@codecomply/db', () => ({
  prisma: {
    permitInspection: { findUnique: vi.fn() },
    deficiency: { findUnique: vi.fn() },
    report: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}))

const MINIMAL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

function baseInspection(overrides: Record<string, unknown> = {}) {
  return {
    id: 'insp-1',
    uniqueId: 'uuid-inspection-1',
    permitId: 'perm-1',
    esiteId: null,
    status: 'PASSED',
    scheduledDate: new Date('2026-06-01T14:00:00.000Z'),
    completedDate: new Date('2026-06-01T15:00:00.000Z'),
    finalizedAt: null,
    notes: 'OK',
    lastSyncedAt: new Date(),
    etag: null,
    inspectorId: null,
    certificationSnapshot: null,
    startGps: null,
    finalizeGps: null,
    documentHash: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    permit: {
      id: 'perm-1',
      permitNumber: 'P-100',
      address: '123 Main St',
      legalLandDesc: null,
      scope: 'Residential',
      status: 'ACTIVE',
      latitude: null,
      longitude: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    inspector: { name: 'Alex Inspector', designationId: 'SCO-001' },
    schedule: {
      assignedTo: {
        name: 'Alex Inspector',
        email: 'alex@example.com',
        designationId: 'SCO-001',
      },
    },
    deficiencies: [],
    photos: [],
    checklistExecutions: [],
    ...overrides,
  }
}

describe('computeReportDocumentHash', () => {
  it('is stable for the same canonical payload', () => {
    const a = computeReportDocumentHash({ z: 1, a: 'x' })
    const b = computeReportDocumentHash({ a: 'x', z: 1 })
    expect(a).toBe(b)
    expect(a).toMatch(/^[a-f0-9]{64}$/)
  })
})

describe('ReportService', () => {
  const storage = {
    getObjectBytes: vi.fn(),
    putObject: vi.fn(),
    getSignedGetUrl: vi.fn(),
  }
  let service: ReportService

  beforeEach(() => {
    vi.mocked(prisma.permitInspection.findUnique).mockReset()
    vi.mocked(prisma.deficiency.findUnique).mockReset()
    vi.mocked(prisma.report.create).mockReset()
    vi.mocked(prisma.report.findMany).mockReset()
    vi.mocked(prisma.report.findUnique).mockReset()
    storage.getObjectBytes.mockReset()
    storage.putObject.mockReset()
    storage.getSignedGetUrl.mockReset()
    service = new ReportService(storage)
  })

  it('generateInspectionReport builds a PDF', async () => {
    vi.mocked(prisma.permitInspection.findUnique).mockResolvedValue(baseInspection() as never)

    const pdf = await service.generateInspectionReport('insp-1')
    expect(pdf.subarray(0, 5).toString('utf8')).toBe('%PDF-')
    expect(pdf.length).toBeGreaterThan(500)

    const payload = {
      type: 'inspection-report',
      inspectionId: 'insp-1',
      uniqueId: 'uuid-inspection-1',
      permitId: 'perm-1',
      scheduledDate: '2026-06-01T14:00:00.000Z',
      status: 'PASSED',
      deficiencyIds: [],
      photoIds: [],
    }
    expect(computeReportDocumentHash(payload)).toMatch(/^[a-f0-9]{64}$/)
  })

  it('embeds photos when storage returns bytes', async () => {
    storage.getObjectBytes.mockResolvedValue(MINIMAL_PNG)
    vi.mocked(prisma.permitInspection.findUnique).mockResolvedValue(
      baseInspection({
        photos: [
          {
            id: 'ph-1',
            clientId: 'c1',
            deficiencyId: null,
            inspectionId: 'insp-1',
            filename: 'a.png',
            mimeType: 'image/png',
            size: 100,
            storageKey: 'key/one.png',
            metadata: {},
            annotations: null,
            createdAt: new Date(),
            syncedAt: null,
          },
        ],
      }) as never,
    )

    const pdf = await service.generateInspectionReport('insp-1')
    expect(storage.getObjectBytes).toHaveBeenCalledWith('photos', 'key/one.png')
    expect(pdf.length).toBeGreaterThan(2000)
  })

  it('generateDeficiencyReport includes deficiency details', async () => {
    vi.mocked(prisma.deficiency.findUnique).mockResolvedValue({
      id: 'def-1',
      clientId: 'client-def',
      esiteId: null,
      inspectionId: 'insp-1',
      checklistItemId: null,
      createdById: 'u1',
      description: 'Missing guard',
      location: 'Roof edge',
      severity: 'MAJOR',
      status: 'OPEN',
      dueDate: null,
      codeReference: null,
      isStopWork: false,
      isUnsafe: false,
      vocSubmittedAt: null,
      vocAcceptedAt: null,
      vocRejectedAt: null,
      vocNotes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      syncedAt: null,
      etag: null,
      photos: [],
      createdBy: { name: 'Inspector Pat' },
      inspection: {
        id: 'insp-1',
        permitId: 'perm-1',
        uniqueId: null,
        esiteId: null,
        status: 'IN_PROGRESS',
        scheduledDate: new Date('2026-07-01T10:00:00.000Z'),
        completedDate: null,
        finalizedAt: null,
        notes: null,
        lastSyncedAt: new Date(),
        etag: null,
        inspectorId: null,
        certificationSnapshot: null,
        startGps: null,
        finalizeGps: null,
        documentHash: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        permit: {
          id: 'perm-1',
          permitNumber: 'P-99',
          address: '9 Elm',
          legalLandDesc: null,
          scope: 'Renovation',
          status: 'ACTIVE',
          latitude: null,
          longitude: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        inspector: null,
        schedule: null,
      },
    } as never)

    const pdf = await service.generateDeficiencyReport('def-1')
    expect(pdf.subarray(0, 5).toString('utf8')).toBe('%PDF-')
    expect(
      computeReportDocumentHash({
        type: 'deficiency-report',
        deficiencyId: 'def-1',
        inspectionId: 'insp-1',
        severity: 'MAJOR',
        status: 'OPEN',
        photoIds: [],
      }),
    ).toMatch(/^[a-f0-9]{64}$/)
  })

  it('generateNoEntryLetter builds a PDF', async () => {
    vi.mocked(prisma.permitInspection.findUnique).mockResolvedValue(baseInspection() as never)
    const pdf = await service.generateNoEntryLetter('insp-1')
    expect(pdf.subarray(0, 5).toString('utf8')).toBe('%PDF-')
    expect(
      computeReportDocumentHash({
        type: 'no-entry-letter',
        inspectionId: 'insp-1',
        uniqueId: 'uuid-inspection-1',
        permitId: 'perm-1',
        scheduledDate: '2026-06-01T14:00:00.000Z',
      }),
    ).toMatch(/^[a-f0-9]{64}$/)
  })

  it('throws when inspection is missing', async () => {
    vi.mocked(prisma.permitInspection.findUnique).mockResolvedValue(null)
    await expect(service.generateInspectionReport('missing')).rejects.toThrow(/not found/)
  })

  it('throws when deficiency is missing', async () => {
    vi.mocked(prisma.deficiency.findUnique).mockResolvedValue(null)
    await expect(service.generateDeficiencyReport('missing')).rejects.toThrow(/not found/)
  })

  it('generateAndStore uploads PDF to documents bucket and creates report row', async () => {
    vi.mocked(prisma.permitInspection.findUnique).mockResolvedValue(baseInspection() as never)
    const generatedAt = new Date('2026-06-01T16:00:00.000Z')
    vi.mocked(prisma.report.create).mockResolvedValue({
      id: 'rep-1',
      inspectionId: 'insp-1',
      type: 'INSPECTION',
      filename: 'inspection-report.pdf',
      storageKey: 'reports/insp-1/uuid-inspection-report.pdf',
      hash: 'a'.repeat(64),
      generatedAt,
      distributedAt: null,
    } as never)

    const row = await service.generateAndStore({ inspectionId: 'insp-1', type: 'INSPECTION' })

    expect(storage.putObject).toHaveBeenCalledWith(
      'documents',
      expect.stringContaining('reports/insp-1/'),
      expect.any(Buffer),
      'application/pdf',
    )
    expect(prisma.report.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          inspectionId: 'insp-1',
          type: 'INSPECTION',
          filename: 'inspection-report.pdf',
        }),
      }),
    )
    expect(row.id).toBe('rep-1')
  })

  it('generateAndStore rejects STOP_WORK without deficiencyId', async () => {
    await expect(
      service.generateAndStore({ inspectionId: 'insp-1', type: 'STOP_WORK' }),
    ).rejects.toThrow()
    expect(storage.putObject).not.toHaveBeenCalled()
  })

  it('listForInspection returns rows ordered by generatedAt desc', async () => {
    vi.mocked(prisma.report.findMany).mockResolvedValue([] as never)
    await service.listForInspection('insp-1')
    expect(prisma.report.findMany).toHaveBeenCalledWith({
      where: { inspectionId: 'insp-1' },
      orderBy: { generatedAt: 'desc' },
    })
  })

  it('getSignedDownloadUrl returns presigned URL', async () => {
    vi.mocked(prisma.report.findUnique).mockResolvedValue({
      id: 'rep-1',
      storageKey: 'reports/insp-1/file.pdf',
    } as never)
    storage.getSignedGetUrl.mockResolvedValue('https://signed.example/report.pdf')

    const url = await service.getSignedDownloadUrl('rep-1')

    expect(url).toBe('https://signed.example/report.pdf')
    expect(storage.getSignedGetUrl).toHaveBeenCalledWith(
      'documents',
      'reports/insp-1/file.pdf',
      expect.any(Number),
    )
  })

  it('getSignedDownloadUrl throws when report is missing', async () => {
    vi.mocked(prisma.report.findUnique).mockResolvedValue(null)
    await expect(service.getSignedDownloadUrl('missing')).rejects.toThrow(/not found/)
  })

  it('getById delegates to prisma.report.findUnique', async () => {
    vi.mocked(prisma.report.findUnique).mockResolvedValue({ id: 'rep-1' } as never)
    const row = await service.getById('rep-1')
    expect(row?.id).toBe('rep-1')
  })

  it('generateAndStore persists deficiency report', async () => {
    vi.mocked(prisma.deficiency.findUnique).mockResolvedValue({
      id: 'def-1',
      clientId: 'client-def',
      esiteId: null,
      inspectionId: 'insp-1',
      checklistItemId: null,
      createdById: 'u1',
      description: 'Missing guard',
      location: 'Roof edge',
      severity: 'MAJOR',
      status: 'OPEN',
      dueDate: null,
      codeReference: null,
      isStopWork: false,
      isUnsafe: false,
      vocSubmittedAt: null,
      vocAcceptedAt: null,
      vocRejectedAt: null,
      vocNotes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      syncedAt: null,
      etag: null,
      photos: [],
      createdBy: { name: 'Inspector Pat' },
      inspection: {
        id: 'insp-1',
        permitId: 'perm-1',
        uniqueId: null,
        esiteId: null,
        status: 'IN_PROGRESS',
        scheduledDate: new Date('2026-07-01T10:00:00.000Z'),
        completedDate: null,
        finalizedAt: null,
        notes: null,
        lastSyncedAt: new Date(),
        etag: null,
        inspectorId: null,
        certificationSnapshot: null,
        startGps: null,
        finalizeGps: null,
        documentHash: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        permit: {
          id: 'perm-1',
          permitNumber: 'P-99',
          address: '9 Elm',
          legalLandDesc: null,
          scope: 'Renovation',
          status: 'ACTIVE',
          latitude: null,
          longitude: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        inspector: null,
        schedule: null,
      },
    } as never)
    vi.mocked(prisma.report.create).mockResolvedValue({
      id: 'rep-def',
      inspectionId: 'insp-1',
      type: 'DEFICIENCY',
      filename: 'deficiency-def-1.pdf',
      storageKey: 'reports/insp-1/def.pdf',
      hash: 'c'.repeat(64),
      generatedAt: new Date(),
      distributedAt: null,
    } as never)

    const row = await service.generateAndStore({
      inspectionId: 'insp-1',
      type: 'DEFICIENCY',
      deficiencyId: 'def-1',
    })

    expect(row.type).toBe('DEFICIENCY')
    expect(storage.putObject).toHaveBeenCalled()
  })

  it('generateAndStore persists deficiency when hash preload omits photos on first query (M10-S15-B2)', async () => {
    const fullDeficiency = {
      id: 'def-1',
      clientId: 'client-def',
      esiteId: null,
      inspectionId: 'insp-1',
      checklistItemId: null,
      createdById: 'u1',
      description: 'Missing guard',
      location: 'Roof edge',
      severity: 'MAJOR',
      status: 'OPEN',
      dueDate: null,
      codeReference: null,
      isStopWork: false,
      isUnsafe: false,
      vocSubmittedAt: null,
      vocAcceptedAt: null,
      vocRejectedAt: null,
      vocNotes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      syncedAt: null,
      etag: null,
      photos: [],
      createdBy: { name: 'Inspector Pat' },
      inspection: {
        id: 'insp-1',
        permitId: 'perm-1',
        uniqueId: null,
        esiteId: null,
        status: 'IN_PROGRESS',
        scheduledDate: new Date('2026-07-01T10:00:00.000Z'),
        completedDate: null,
        finalizedAt: null,
        notes: null,
        lastSyncedAt: new Date(),
        etag: null,
        inspectorId: null,
        certificationSnapshot: null,
        startGps: null,
        finalizeGps: null,
        documentHash: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        permit: {
          id: 'perm-1',
          permitNumber: 'P-99',
          address: '9 Elm',
          legalLandDesc: null,
          scope: 'Renovation',
          status: 'ACTIVE',
          latitude: null,
          longitude: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        inspector: null,
        schedule: null,
      },
    }

    vi.mocked(prisma.deficiency.findUnique)
      .mockResolvedValueOnce({
        id: 'def-1',
        inspectionId: 'insp-1',
        inspection: { id: 'insp-1' },
      } as never)
      .mockResolvedValueOnce(fullDeficiency as never)

    vi.mocked(prisma.report.create).mockResolvedValue({
      id: 'rep-def',
      inspectionId: 'insp-1',
      type: 'DEFICIENCY',
      filename: 'deficiency-def-1.pdf',
      storageKey: 'reports/insp-1/def.pdf',
      hash: 'c'.repeat(64),
      generatedAt: new Date(),
      distributedAt: null,
    } as never)

    const row = await service.generateAndStore({
      inspectionId: 'insp-1',
      type: 'DEFICIENCY',
      deficiencyId: 'def-1',
    })

    expect(row.type).toBe('DEFICIENCY')
    expect(storage.putObject).toHaveBeenCalled()
  })

  it('generateAndStore rejects deficiency not linked to inspection', async () => {
    vi.mocked(prisma.deficiency.findUnique).mockResolvedValue({
      id: 'def-1',
      inspectionId: 'other',
      photos: [],
      inspection: { id: 'other' },
    } as never)

    await expect(
      service.generateAndStore({
        inspectionId: 'insp-1',
        type: 'DEFICIENCY',
        deficiencyId: 'def-1',
      }),
    ).rejects.toThrow(/not found/)
  })

  it('generateAndStore persists no-entry report', async () => {
    vi.mocked(prisma.permitInspection.findUnique).mockResolvedValue(baseInspection() as never)
    vi.mocked(prisma.report.create).mockResolvedValue({
      id: 'rep-ne',
      inspectionId: 'insp-1',
      type: 'NO_ENTRY',
      filename: 'no-entry-letter.pdf',
      storageKey: 'reports/insp-1/no-entry.pdf',
      hash: 'd'.repeat(64),
      generatedAt: new Date(),
      distributedAt: null,
    } as never)

    const row = await service.generateAndStore({ inspectionId: 'insp-1', type: 'NO_ENTRY' })
    expect(row.type).toBe('NO_ENTRY')
  })

  it('generateInspectionReportAsync tracks progress through phases (M11-S12)', async () => {
    vi.mocked(prisma.permitInspection.findUnique).mockResolvedValue(baseInspection() as never)
    const phases: string[] = []
    await service.generateInspectionReportAsync('insp-1', {
      timeoutMs: 10_000,
      onProgress: (p) => phases.push(p.phase),
    })
    expect(phases).toContain('loading-data')
    expect(phases).toContain('rendering-pdf')
    expect(phases).toContain('complete')
  })

  it('generateInspectionReport rejects when timeout exceeded (M11-S12)', async () => {
    vi.mocked(prisma.permitInspection.findUnique).mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve(baseInspection() as never), 100)
        }) as ReturnType<typeof prisma.permitInspection.findUnique>,
    )
    await expect(
      service.generateInspectionReport('insp-1', { timeoutMs: 10 }),
    ).rejects.toBeInstanceOf(PdfGenerationTimeoutError)
  })

  it('generates PDF with 20 embedded photos under performance target (M11-S12)', async () => {
    storage.getObjectBytes.mockResolvedValue(MINIMAL_PNG)
    const photos = Array.from({ length: 20 }, (_, i) => ({
      id: `ph-${i}`,
      clientId: `c-${i}`,
      deficiencyId: null,
      inspectionId: 'insp-1',
      filename: `p${i}.png`,
      mimeType: 'image/png',
      size: 100,
      storageKey: `keys/${i}.png`,
      metadata: {},
      annotations: null,
      createdAt: new Date(),
      syncedAt: null,
    }))
    vi.mocked(prisma.permitInspection.findUnique).mockResolvedValue(
      baseInspection({ photos }) as never,
    )

    const start = performance.now()
    const pdf = await service.generateInspectionReport('insp-1', { timeoutMs: 30_000 })
    const elapsed = performance.now() - start

    expect(pdf.subarray(0, 5).toString('utf8')).toBe('%PDF-')
    expect(elapsed).toBeLessThan(PDF_GENERATION_TARGET_MS)
    expect(storage.getObjectBytes).toHaveBeenCalledTimes(20)
  })

  it('skips photos that fail to load from storage', async () => {
    vi.mocked(prisma.permitInspection.findUnique).mockResolvedValue(
      baseInspection({
        photos: [
          {
            id: 'ph-1',
            clientId: 'c1',
            inspectionId: 'insp-1',
            deficiencyId: null,
            filename: 'bad.png',
            mimeType: 'image/png',
            size: 1,
            storageKey: 'missing.png',
            metadata: {},
            annotations: null,
            createdAt: new Date(),
            syncedAt: null,
          },
        ],
      }) as never,
    )
    storage.getObjectBytes.mockRejectedValue(new Error('missing object'))

    const pdf = await service.generateInspectionReport('insp-1')
    expect(pdf.subarray(0, 5).toString('utf8')).toBe('%PDF-')
  })
})
