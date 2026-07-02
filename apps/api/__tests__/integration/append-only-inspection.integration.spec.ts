import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { integrationDb as db } from '../../src/test-utils/integration-db.js'
import { InspectionService } from '../../src/services/inspection.service.js'
import { ImmutableInspectionError } from '../../src/middleware/immutable.js'

describe.sequential('Append-only finalized inspections (M10-S8)', () => {
  const service = new InspectionService()
  let inspectorId: string
  let inspectionId: string

  beforeAll(async () => {
    const inspector = await db.user.create({
      data: {
        email: `m10-s8-append-${Date.now()}@example.com`,
        name: 'M10 S8 Inspector',
        role: 'SCO',
      },
    })
    inspectorId = inspector.id

    const inspection = await db.permitInspection.create({
      data: {
        scheduledDate: new Date('2026-11-15T09:00:00.000Z'),
        status: 'PASSED',
        finalizedAt: new Date('2026-11-15T11:00:00.000Z'),
        completedDate: new Date('2026-11-15T11:00:00.000Z'),
        inspectorId,
        notes: 'M10-S8 append-only integration',
        documentHash: 'd'.repeat(64),
      },
    })
    inspectionId = inspection.id

    await db.inspectionSchedule.create({
      data: {
        inspectionId,
        assignedToId: inspectorId,
      },
    })
  })

  afterAll(async () => {
    await db.addendum.deleteMany({ where: { inspectionId } })
    await db.inspectionSchedule.deleteMany({ where: { inspectionId } })
    await db.permitInspection.deleteMany({ where: { id: inspectionId } })
    await db.user.deleteMany({ where: { id: inspectorId } })
  })

  it('blocks update and delete on finalized inspection', async () => {
    await expect(service.update(inspectionId, inspectorId, { notes: 'tamper' })).rejects.toThrow(
      ImmutableInspectionError,
    )
    await expect(service.delete(inspectionId, inspectorId)).rejects.toThrow(
      ImmutableInspectionError,
    )

    const row = await db.permitInspection.findUniqueOrThrow({ where: { id: inspectionId } })
    expect(row.notes).toContain('M10-S8')
  })

  it('logs immutable violation attempts', async () => {
    const before = await db.auditLog.count({
      where: {
        entityId: inspectionId,
        action: 'INSPECTION_IMMUTABLE_VIOLATION',
      },
    })

    await expect(service.update(inspectionId, inspectorId, { notes: 'again' })).rejects.toThrow()

    const after = await db.auditLog.count({
      where: {
        entityId: inspectionId,
        action: 'INSPECTION_IMMUTABLE_VIOLATION',
      },
    })
    expect(after).toBeGreaterThan(before)
  })

  it('allows addendum on finalized inspection', async () => {
    const addendum = await service.createAddendum(inspectionId, inspectorId, {
      reason: 'Clarify address',
      content: 'Site address corrected to 123 Main Street NW.',
      signature: 'data:image/png;base64,integration',
    })

    expect(addendum.inspectionId).toBe(inspectionId)

    const audit = await db.auditLog.findFirst({
      where: { entityId: inspectionId, action: 'ADDENDUM_CREATED' },
      orderBy: { timestamp: 'desc' },
    })
    expect(audit).not.toBeNull()
  })
})
