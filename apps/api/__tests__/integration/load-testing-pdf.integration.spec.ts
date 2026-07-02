import { describe, it, expect, beforeAll, vi } from 'vitest'
import sharp from 'sharp'
import { prisma } from '@codecomply/db'
import { ReportService } from '../../src/services/report.service.js'
import {
  LOAD_TEST_MAX_HEAP_GROWTH_BYTES,
  LOAD_TEST_PDF_CONCURRENCY,
  LOAD_TEST_PDF_P95_MS,
} from '../../src/lib/load-test/load-test-config.js'
import {
  captureMemoryProfile,
  summarizeLoadTest,
} from '../../src/lib/load-test/load-test-metrics.js'
import { runConcurrentLoad } from '../../src/lib/load-test/load-test-runner.js'
import { PDF_GENERATION_TARGET_MS } from '../../src/lib/pdf/pdf-generation-config.js'

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

describe('Load testing PDF integration (M11-S13)', () => {
  let mediumJpeg: Buffer

  beforeAll(async () => {
    mediumJpeg = await sharp({
      create: { width: 400, height: 300, channels: 3, background: '#666666' },
    })
      .jpeg({ quality: 70 })
      .toBuffer()
  })

  it(`runs ${LOAD_TEST_PDF_CONCURRENCY} concurrent PDF generations within target`, async () => {
    const storage = {
      getObjectBytes: async () => new Uint8Array(mediumJpeg),
      putObject: async () => {},
      getSignedGetUrl: async () => 'https://example.test/signed',
    }
    const service = new ReportService(storage)

    const photos = Array.from({ length: 5 }, (_, i) => ({
      id: `ld-ph-${i}`,
      clientId: `ld-c-${i}`,
      deficiencyId: null,
      inspectionId: 'ld-insp',
      filename: `p-${i}.jpg`,
      mimeType: 'image/jpeg',
      size: MINIMAL_PNG.length,
      storageKey: `ld/key-${i}.jpg`,
      metadata: {},
      annotations: null,
      createdAt: new Date(),
      syncedAt: null,
    }))

    vi.mocked(prisma.permitInspection.findUnique).mockResolvedValue({
      id: 'ld-insp',
      uniqueId: 'uuid-ld',
      permitId: 'perm-ld',
      esiteId: null,
      status: 'PASSED',
      scheduledDate: new Date(),
      completedDate: new Date(),
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
        id: 'perm-ld',
        permitNumber: 'LD-1',
        address: 'Load St',
        legalLandDesc: null,
        scope: 'Test',
        status: 'ACTIVE',
        latitude: null,
        longitude: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      inspector: { name: 'Load', designationId: null },
      schedule: null,
      deficiencies: [],
      photos,
      checklistExecutions: [],
    } as never)

    const heapBefore = process.memoryUsage()

    const { timings } = await runConcurrentLoad(
      LOAD_TEST_PDF_CONCURRENCY,
      async () => {
        const pdf = await service.generateInspectionReport('ld-insp', {
          timeoutMs: PDF_GENERATION_TARGET_MS,
        })
        if (pdf.subarray(0, 5).toString('utf8') !== '%PDF-') {
          throw new Error('invalid pdf')
        }
        return pdf.length
      },
      { concurrency: LOAD_TEST_PDF_CONCURRENCY },
    )

    const summary = summarizeLoadTest(timings)
    const profile = captureMemoryProfile(heapBefore, process.memoryUsage())

    expect(summary.successRate).toBe(1)
    expect(summary.p95Ms).toBeLessThan(LOAD_TEST_PDF_P95_MS)
    expect(profile.heapGrowthBytes).toBeLessThan(LOAD_TEST_MAX_HEAP_GROWTH_BYTES)
  })
})
