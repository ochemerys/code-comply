import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest'
import { Hono } from 'hono'
import { prisma } from '@codecomply/db'
import reportsRoutes from './reports.js'
import { reportService, resetReportServiceStorageForTests } from '../services/report.service.js'
import { inspectionService } from '../services/inspection.service.js'
import {
  getInMemoryObjectStorageClient,
  resetInMemoryObjectStorageForTests,
} from '../lib/storage/storage-client.js'

vi.mock('../services/inspection.service.js', () => ({
  inspectionService: {
    getById: vi.fn(),
  },
}))

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

const baseInspection = () => ({
  id: 'insp-dev-report',
  uniqueId: 'uuid-insp-dev',
  permitId: 'perm-1',
  esiteId: null,
  status: 'IN_PROGRESS',
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
  permit: {
    id: 'perm-1',
    permitNumber: 'BP-2024-002',
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
})

function fullDeficiencyRow() {
  return {
    id: 'def-dev-1',
    clientId: 'client-def',
    esiteId: null,
    inspectionId: 'insp-dev-report',
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
      id: 'insp-dev-report',
      permitId: 'perm-1',
      uniqueId: null,
      esiteId: null,
      status: 'IN_PROGRESS',
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
      permit: baseInspection().permit,
      inspector: baseInspection().inspector,
      schedule: baseInspection().schedule,
    },
  }
}

describe('POST /reports/generate without R2 credentials (M10-S15-B1)', () => {
  const envSnapshot = { ...process.env }

  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.R2_ACCESS_KEY_ID
    delete process.env.R2_SECRET_ACCESS_KEY
    process.env.NODE_ENV = 'development'
    process.env.PORT = '4000'
    resetReportServiceStorageForTests()
    resetInMemoryObjectStorageForTests()

    vi.mocked(inspectionService.getById).mockResolvedValue({ id: 'insp-dev-report' } as never)
    vi.mocked(prisma.permitInspection.findUnique).mockResolvedValue(baseInspection() as never)
    ;(prisma.report.create as Mock).mockImplementation(async ({ data }) => ({
      id: 'rep-dev-1',
      inspectionId: data.inspectionId,
      type: data.type,
      filename: data.filename,
      storageKey: data.storageKey,
      hash: data.hash,
      generatedAt: new Date('2026-06-01T16:00:00.000Z'),
      distributedAt: null,
    }))
  })

  afterEach(() => {
    process.env = { ...envSnapshot }
    resetReportServiceStorageForTests()
    resetInMemoryObjectStorageForTests()
  })

  it('returns 201 and stores PDF in development in-memory storage', async () => {
    const app = new Hono<{ Variables: { userId: string } }>()
    app.use('*', async (c, next) => {
      c.set('userId', 'admin-1')
      await next()
    })
    app.route('/', reportsRoutes)

    const res = await app.request('/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inspectionId: 'insp-dev-report', type: 'INSPECTION' }),
    })

    expect(res.status).toBe(201)
    const body = (await res.json()) as {
      id: string
      type: string
      filename: string
      storageKey: string
    }
    expect(body.type).toBe('INSPECTION')
    expect(body.filename).toBe('inspection-report.pdf')

    const storageKey = body.storageKey
    const bytes = await getInMemoryObjectStorageClient().getObjectBytes('documents', storageKey)
    expect(Buffer.from(bytes).subarray(0, 5).toString('utf8')).toBe('%PDF-')

    vi.mocked(prisma.report.findUnique).mockResolvedValue({
      id: body.id,
      inspectionId: 'insp-dev-report',
      type: 'INSPECTION',
      filename: body.filename,
      storageKey,
      hash: 'a'.repeat(64),
      generatedAt: new Date('2026-06-01T16:00:00.000Z'),
      distributedAt: null,
    } as never)

    const url = await reportService.getSignedDownloadUrl(body.id)
    expect(url).toContain('/dev/storage/documents/')
  })
})

describe('POST /reports/generate deficiency without R2 credentials (M10-S15-B2)', () => {
  const envSnapshot = { ...process.env }

  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.R2_ACCESS_KEY_ID
    delete process.env.R2_SECRET_ACCESS_KEY
    process.env.NODE_ENV = 'development'
    process.env.PORT = '4000'
    resetReportServiceStorageForTests()
    resetInMemoryObjectStorageForTests()

    vi.mocked(inspectionService.getById).mockResolvedValue({ id: 'insp-dev-report' } as never)
    ;(prisma.report.create as Mock).mockImplementation(async ({ data }) => ({
      id: 'rep-def-dev',
      inspectionId: data.inspectionId,
      type: data.type,
      filename: data.filename,
      storageKey: data.storageKey,
      hash: data.hash,
      generatedAt: new Date('2026-06-01T16:00:00.000Z'),
      distributedAt: null,
    }))
  })

  afterEach(() => {
    process.env = { ...envSnapshot }
    resetReportServiceStorageForTests()
    resetInMemoryObjectStorageForTests()
  })

  it('returns 201 for DEFICIENCY report when preload query has no photos relation', async () => {
    const full = fullDeficiencyRow()
    vi.mocked(prisma.deficiency.findUnique)
      .mockResolvedValueOnce({
        id: 'def-dev-1',
        inspectionId: 'insp-dev-report',
        inspection: { id: 'insp-dev-report' },
      } as never)
      .mockResolvedValueOnce(full as never)

    const app = new Hono<{ Variables: { userId: string } }>()
    app.use('*', async (c, next) => {
      c.set('userId', 'admin-1')
      await next()
    })
    app.route('/', reportsRoutes)

    const res = await app.request('/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inspectionId: 'insp-dev-report',
        type: 'DEFICIENCY',
        deficiencyId: 'def-dev-1',
      }),
    })

    expect(res.status).toBe(201)
    const body = (await res.json()) as { type: string; filename: string; storageKey: string }
    expect(body.type).toBe('DEFICIENCY')
    expect(body.filename).toBe('deficiency-def-dev-1.pdf')
  })
})
