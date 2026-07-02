import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { integrationDb as db } from '../../src/test-utils/integration-db.js'
import { ReportService, REPORT_SIGNED_URL_TTL_SECONDS } from '../../src/services/report.service.js'
import type { ObjectStorageClient } from '../../src/lib/storage/storage-client.js'

describe.sequential('ReportService integration (M10-S9)', () => {
  let inspectionId: string
  let userId: string
  let permitId: string
  let service: ReportService
  const putObject = vi.fn(
    async (_kind: 'photos' | 'documents', _key: string, _body: Buffer, _ct?: string) => {},
  )
  const getSignedGetUrl = vi.fn(
    async (_kind: 'photos' | 'documents', key: string, _ttl: number) =>
      `https://signed.example/${key}`,
  )

  beforeAll(async () => {
    userId = `report-svc-user-${Date.now()}`
    await db.user.create({
      data: {
        id: userId,
        email: `m10-s9-report-svc-${Date.now()}@example.com`,
        name: 'Report Svc Int',
        role: 'SCO',
      },
    })

    const permit = await db.permit.create({
      data: {
        permitNumber: `M10-S9-${Date.now()}`,
        address: '1 Report Lane',
        scope: 'Residential',
        status: 'ACTIVE',
      },
    })
    permitId = permit.id

    const inspection = await db.permitInspection.create({
      data: {
        permitId,
        scheduledDate: new Date('2026-10-01'),
        status: 'PASSED',
        completedDate: new Date('2026-10-01T12:00:00.000Z'),
        notes: 'M10-S9 report service integration',
        inspectorId: userId,
      },
    })
    inspectionId = inspection.id

    await db.inspectionSchedule.create({
      data: { inspectionId, assignedToId: userId },
    })

    const storage = {
      putObject: (kind: 'photos' | 'documents', key: string, body: Buffer, ct?: string) =>
        putObject(kind, key, body, ct),
      getSignedGetUrl: (kind: 'photos' | 'documents', key: string, ttl: number) =>
        getSignedGetUrl(kind, key, ttl),
      getObjectBytes: async () => new Uint8Array(),
    } as unknown as ObjectStorageClient

    service = new ReportService(storage)
  })

  afterAll(async () => {
    await db.report.deleteMany({ where: { inspectionId } })
    await db.inspectionSchedule.deleteMany({ where: { inspectionId } })
    await db.permitInspection.deleteMany({ where: { id: inspectionId } })
    await db.permit.deleteMany({ where: { id: permitId } })
    await db.user.deleteMany({ where: { id: userId } })
  })

  it('generateAndStore writes PDF to documents bucket and persists Report row', async () => {
    putObject.mockClear()

    const row = await service.generateAndStore({ inspectionId, type: 'INSPECTION' })

    expect(row.inspectionId).toBe(inspectionId)
    expect(row.type).toBe('INSPECTION')
    expect(row.hash).toMatch(/^[a-f0-9]{64}$/)
    expect(putObject).toHaveBeenCalledWith(
      'documents',
      expect.stringContaining(`reports/${inspectionId}/`),
      expect.any(Buffer),
      'application/pdf',
    )

    const stored = await db.report.findUniqueOrThrow({ where: { id: row.id } })
    expect(stored.storageKey).toBe(row.storageKey)
  })

  it('listForInspection returns generated reports', async () => {
    const rows = await service.listForInspection(inspectionId)
    expect(rows.length).toBeGreaterThanOrEqual(1)
    expect(rows[0].inspectionId).toBe(inspectionId)
  })

  it('getSignedDownloadUrl returns presigned URL for stored report', async () => {
    getSignedGetUrl.mockClear()
    const [row] = await service.listForInspection(inspectionId)

    const url = await service.getSignedDownloadUrl(row.id)

    expect(url).toContain(row.storageKey)
    expect(getSignedGetUrl).toHaveBeenCalledWith(
      'documents',
      row.storageKey,
      REPORT_SIGNED_URL_TTL_SECONDS,
    )
  })
})
