import { describe, it, expect, beforeAll, vi } from 'vitest'
import sharp from 'sharp'
import { prisma } from '@codecomply/db'
import { ReportService } from '../../src/services/report.service.js'
import { PDF_GENERATION_TARGET_MS } from '../../src/lib/pdf/pdf-generation-config.js'
import type { PdfGenerationProgress } from '../../src/lib/pdf/pdf-generation-progress.js'

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

function photoRow(index: number) {
  return {
    id: `ph-${index}`,
    clientId: `c-${index}`,
    deficiencyId: null,
    inspectionId: 'insp-perf',
    filename: `photo-${index}.jpg`,
    mimeType: 'image/jpeg',
    size: MINIMAL_PNG.length,
    storageKey: `perf/key-${index}.jpg`,
    metadata: {},
    annotations: null,
    createdAt: new Date(),
    syncedAt: null,
  }
}

describe('PDF generation performance (M11-S12)', () => {
  let mediumJpeg: Buffer

  beforeAll(async () => {
    mediumJpeg = await sharp({
      create: { width: 1600, height: 1200, channels: 3, background: '#888888' },
    })
      .jpeg({ quality: 85 })
      .toBuffer()
  })

  it('generates inspection PDF with 20 photos under 10 seconds', async () => {
    const storage = {
      getObjectBytes: async () => new Uint8Array(mediumJpeg),
      putObject: async () => {},
      getSignedGetUrl: async () => 'https://example.test/signed',
    }
    const service = new ReportService(storage)

    const photos = Array.from({ length: 20 }, (_, i) => photoRow(i))

    vi.mocked(prisma.permitInspection.findUnique).mockResolvedValue({
      id: 'insp-perf',
      uniqueId: 'uuid-perf',
      permitId: 'perm-1',
      esiteId: null,
      status: 'PASSED',
      scheduledDate: new Date('2026-06-01T14:00:00.000Z'),
      completedDate: new Date('2026-06-01T15:00:00.000Z'),
      finalizedAt: null,
      notes: 'Performance test',
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
        permitNumber: 'P-PERF',
        address: '1 Perf Lane',
        legalLandDesc: null,
        scope: 'Residential',
        status: 'ACTIVE',
        latitude: null,
        longitude: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      inspector: { name: 'Perf Inspector', designationId: 'SCO-P' },
      schedule: null,
      deficiencies: [],
      photos,
      checklistExecutions: [],
    } as never)

    const progress: PdfGenerationProgress[] = []
    const start = performance.now()
    const pdf = await service.generateInspectionReport('insp-perf', {
      timeoutMs: 30_000,
      onProgress: (p) => progress.push({ ...p }),
    })
    const elapsed = performance.now() - start

    expect(pdf.subarray(0, 5).toString('utf8')).toBe('%PDF-')
    expect(elapsed).toBeLessThan(PDF_GENERATION_TARGET_MS)
    expect(progress.some((p) => p.phase === 'preparing-images')).toBe(true)
    expect(progress.some((p) => p.phase === 'complete')).toBe(true)
  })

  it('completes PDF with 50 photos without crashing', async () => {
    const storage = {
      getObjectBytes: async () => new Uint8Array(MINIMAL_PNG),
      putObject: async () => {},
      getSignedGetUrl: async () => 'https://example.test/signed',
    }
    const service = new ReportService(storage)
    const photos = Array.from({ length: 50 }, (_, i) => photoRow(i))

    vi.mocked(prisma.permitInspection.findUnique).mockResolvedValue({
      id: 'insp-50',
      uniqueId: 'uuid-50',
      permitId: 'perm-1',
      esiteId: null,
      status: 'PASSED',
      scheduledDate: new Date('2026-06-01T14:00:00.000Z'),
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
      permit: null,
      inspector: { name: 'Inspector', designationId: null },
      schedule: null,
      deficiencies: [],
      photos,
      checklistExecutions: [],
    } as never)

    const pdf = await service.generateInspectionReport('insp-50', { timeoutMs: 60_000 })
    expect(pdf.length).toBeGreaterThan(1000)
  })
})
