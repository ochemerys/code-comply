import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { integrationDb as db } from '../../src/test-utils/integration-db.js'
import { inspectionService } from '../../src/services/inspection.service.js'
import { DeficiencyService } from '../../src/services/deficiency.service.js'
import {
  auditLogService,
  AUDIT_ACTION,
  AUDIT_ENTITY,
} from '../../src/services/audit-log.service.js'

describe.sequential('AuditLogService integration (M8-S8)', () => {
  const deficiencyService = new DeficiencyService()
  let inspectorId: string
  let inspectionId: string
  let permitId: string
  const longDescription = 'At least ten chars for deficiency description text here'

  beforeAll(async () => {
    const inspector = await db.user.create({
      data: {
        email: `m8-s8-audit-${Date.now()}@example.com`,
        name: 'M8-S8 Audit',
        role: 'SCO',
      },
    })
    inspectorId = inspector.id

    const permit = await db.permit.create({
      data: {
        permitNumber: `M8-S8-AUDIT-${Date.now()}`,
        address: '100 Audit Trail',
        scope: 'Test',
      },
    })
    permitId = permit.id

    const inspection = await db.permitInspection.create({
      data: {
        permitId,
        scheduledDate: new Date('2026-08-01'),
        status: 'SCHEDULED',
        notes: 'M8-S8 audit log integration',
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
    // audit_logs rows are append-only (DB trigger); leave orphan audit rows for this inspection in dev DB
    await db.deficiency.deleteMany({ where: { inspectionId } })
    await db.inspectionSchedule.deleteMany({ where: { inspectionId } })
    await db.permitInspection.deleteMany({ where: { id: inspectionId } })
    await db.permit.deleteMany({ where: { id: permitId } })
    await db.user.deleteMany({ where: { id: inspectorId } })
  })

  it('records append-only entries for inspection lifecycle and deficiency create', async () => {
    await auditLogService.append({
      entityType: AUDIT_ENTITY.PERMIT_INSPECTION,
      entityId: inspectionId,
      action: AUDIT_ACTION.INSPECTION_CREATED,
      userId: inspectorId,
      beforeData: null,
      afterData: { inspectionId, status: 'SCHEDULED' },
    })

    await inspectionService.start(inspectionId, inspectorId, {
      latitude: 51.0447,
      longitude: -114.0719,
      accuracy: 10,
      timestamp: new Date().toISOString(),
    })

    await deficiencyService.create(
      {
        clientId: `m8-s8-cli-${Date.now()}`,
        inspectionId,
        description: longDescription,
        severity: 'MINOR',
        isStopWork: false,
        isUnsafe: false,
      },
      inspectorId,
    )

    const inspectionLogs = await auditLogService.listForEntity(
      AUDIT_ENTITY.PERMIT_INSPECTION,
      inspectionId,
    )
    const actions = inspectionLogs.map((l) => l.action)
    expect(actions).toContain(AUDIT_ACTION.INSPECTION_CREATED)
    expect(actions).toContain(AUDIT_ACTION.INSPECTION_STARTED)

    const defRows = await db.deficiency.findMany({ where: { inspectionId } })
    expect(defRows).toHaveLength(1)
    const defLogs = await auditLogService.listForEntity(AUDIT_ENTITY.DEFICIENCY, defRows[0]!.id)
    expect(defLogs.some((l) => l.action === AUDIT_ACTION.DEFICIENCY_CREATED)).toBe(true)
  })
})
