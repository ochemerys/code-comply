import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { Prisma } from '@prisma/client'
import { integrationDb as db } from '../../src/test-utils/integration-db.js'

const ROUTE_USER = `inspection-finalization-user-${Date.now()}`

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

const { app } = await import('../../src/app.js')

describe.sequential('Inspection finalization HTTP routes (M8-S9)', () => {
  let inspectionId: string
  let permitId: string
  let templateId: string

  beforeAll(async () => {
    await db.checklistExecution.deleteMany()
    await db.checklistTemplate.deleteMany()
    await db.inspectionSchedule.deleteMany()
    await db.permitInspection.deleteMany()
    await db.permit.deleteMany()
    await db.user.deleteMany({ where: { id: ROUTE_USER } })

    await db.user.create({
      data: {
        id: ROUTE_USER,
        email: `m8-s9-${Date.now()}@example.com`,
        name: 'M8 S9 Finalization',
        role: 'SCO',
      },
    })

    const permit = await db.permit.create({
      data: {
        permitNumber: `M8-S9-${Date.now()}`,
        address: 'Finalization routes test',
        scope: 'Test',
      },
    })
    permitId = permit.id

    const inspection = await db.permitInspection.create({
      data: {
        permitId,
        scheduledDate: new Date('2026-07-01'),
        status: 'IN_PROGRESS',
        notes: '',
      },
    })
    inspectionId = inspection.id

    await db.inspectionSchedule.create({
      data: { inspectionId, assignedToId: ROUTE_USER },
    })

    const template = await db.checklistTemplate.create({
      data: {
        name: 'M8-S9 Template',
        discipline: 'GENERAL',
        version: 1,
        versionHash: `vh-${Date.now()}`,
        items: [
          { id: 'item-1', title: 'Item 1', required: true, requiresPhoto: false },
          { id: 'item-2', title: 'Item 2', required: true, requiresPhoto: false },
        ],
        isActive: true,
      },
    })
    templateId = template.id

    await db.checklistExecution.create({
      data: {
        inspectionId,
        templateId,
        versionHash: template.versionHash,
        responses: [
          { itemId: 'item-1', result: 'PASS', timestamp: '2026-07-01T10:00:00Z' },
          { itemId: 'item-2', result: 'PASS', timestamp: '2026-07-01T10:05:00Z' },
        ],
        progress: 100,
        completedAt: new Date(),
      },
    })
  })

  afterAll(async () => {
    await db.checklistExecution.deleteMany({ where: { inspectionId } })
    await db.checklistTemplate.deleteMany({ where: { id: templateId } })
    await db.inspectionSchedule.deleteMany({ where: { inspectionId } })
    await db.permitInspection.deleteMany({ where: { id: inspectionId } })
    await db.permit.deleteMany({ where: { id: permitId } })
    await db.user.deleteMany({ where: { id: ROUTE_USER } })
  })

  beforeEach(async () => {
    vi.restoreAllMocks()
    await db.permitInspection.update({
      where: { id: inspectionId },
      data: {
        status: 'IN_PROGRESS',
        notes: '',
        finalizedAt: null,
        completedDate: null,
        inspectorId: null,
        certificationSnapshot: Prisma.DbNull,
        finalizeGps: Prisma.DbNull,
        documentHash: null,
      },
    })
  })

  it('POST /api/inspections/:id/validate returns errors when not ready', async () => {
    const res = await app.request(`/api/inspections/${inspectionId}/validate`, { method: 'POST' })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { isValid: boolean; errors: Array<{ code: string }> }
    expect(body.isValid).toBe(false)
    const codes = body.errors.map((e) => e.code)
    expect(codes).toContain('NO_OUTCOME')
    expect(codes).toContain('MISSING_SIGNATURE')
    expect(codes).toContain('MISSING_GPS')
  })

  it('GET /api/inspections/:id/review returns inspection + validation payload', async () => {
    const res = await app.request(`/api/inspections/${inspectionId}/review`)
    expect(res.status).toBe(200)
    const body = (await res.json()) as any
    expect(body.inspection?.id).toBe(inspectionId)
    expect(typeof body.validation?.isValid).toBe('boolean')
    expect(Array.isArray(body.validation?.errors)).toBe(true)
  })

  it('POST /api/inspections/:id/finalize finalizes atomically when valid', async () => {
    const res = await app.request(`/api/inspections/${inspectionId}/finalize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        signature: 'signed-by-test',
        outcome: 'PASSED',
        gps: {
          latitude: 51.0447,
          longitude: -114.0719,
          accuracy: 5,
          timestamp: '2026-07-01T11:00:00Z',
        },
      }),
    })
    expect(res.status).toBe(200)
    const dto = (await res.json()) as { id: string; status: string }
    expect(dto.id).toBe(inspectionId)
    expect(dto.status).toBe('PASSED')

    const row = await db.permitInspection.findUniqueOrThrow({ where: { id: inspectionId } })
    expect(row.finalizedAt).toBeTruthy()
    expect(row.completedDate).toBeTruthy()
    expect(row.documentHash).toBeTruthy()
    expect(row.certificationSnapshot).toBeTruthy()
    expect(typeof row.notes).toBe('string')
    expect(row.notes ?? '').toContain('[SIGNATURE_CAPTURED]')
    expect(row.notes ?? '').toContain('[FINALIZATION_GPS]')
  })
})
