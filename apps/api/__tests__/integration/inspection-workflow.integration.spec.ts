import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { integrationDb as db } from '../../src/test-utils/integration-db.js'
import { inspectionWorkflowService } from '../../src/services/inspection-workflow.service.js'

const PREFIX = `lsc-workflow-${Date.now()}`

describe.sequential('Inspection workflow (LSC-A-01–03)', () => {
  let inspectionId: string
  let permitId: string
  let userId: string

  beforeAll(async () => {
    userId = `${PREFIX}-user`
    await db.inspectionWorkflow.deleteMany()
    await db.report.deleteMany()
    await db.inspectionSchedule.deleteMany()
    await db.permitInspection.deleteMany()
    await db.permit.deleteMany()
    await db.user.deleteMany({ where: { id: userId } })

    await db.user.create({
      data: {
        id: userId,
        email: `${PREFIX}@example.com`,
        name: 'Workflow Test',
        role: 'SCO',
      },
    })

    const permit = await db.permit.create({
      data: {
        permitNumber: `${PREFIX}-permit`,
        address: 'Workflow integration',
        scope: 'Test',
      },
    })
    permitId = permit.id

    const inspection = await db.permitInspection.create({
      data: {
        permitId,
        scheduledDate: new Date('2026-08-01'),
        status: 'IN_PROGRESS',
      },
    })
    inspectionId = inspection.id

    await db.inspectionSchedule.create({
      data: { inspectionId, assignedToId: userId },
    })
  })

  afterAll(async () => {
    await db.inspectionWorkflow.deleteMany({ where: { inspectionId } })
    await db.report.deleteMany({ where: { inspectionId } })
    await db.inspectionSchedule.deleteMany({ where: { inspectionId } })
    await db.permitInspection.deleteMany({ where: { id: inspectionId } })
    await db.permit.deleteMany({ where: { id: permitId } })
    await db.user.deleteMany({ where: { id: userId } })
  })

  it('flags re-inspection fee when unable-to-enter sync includes first notification', async () => {
    await inspectionWorkflowService.upsertFromSync(
      {
        inspectionId,
        unableToEnter: {
          firstNotificationDate: '2026-01-10T12:00:00.000Z',
          comments: 'No access',
          geofenceProof: {
            latitude: 53.5461,
            longitude: -113.4938,
            accuracy: 8,
          },
        },
      },
      userId,
    )

    const wf = await db.inspectionWorkflow.findUnique({ where: { inspectionId } })
    expect(wf?.reInspectionFeeFlagged).toBe(true)
    expect(wf?.firstNotificationDate).toBeTruthy()
    expect(wf?.geofenceProof).toBeTruthy()

    const permit = await db.permit.findUnique({ where: { id: permitId } })
    expect(permit?.reInspectionFeeFlagged).toBe(true)

    const detail = await inspectionWorkflowService.getAdminDetail(inspectionId)
    expect(detail?.reInspectionFeeFlagged).toBe(true)
    expect(detail?.permitReInspectionFeeFlagged).toBe(true)
  })

  it('records field unable-to-enter with GPS proof via recordUnableToEnterFromField', async () => {
    const result = await inspectionWorkflowService.recordUnableToEnterFromField(
      inspectionId,
      userId,
      {
        attemptAt: '2026-06-10T10:15:00.000Z',
        comments: 'Gate locked; no adult present',
        geofenceProof: {
          latitude: 53.6123,
          longitude: -113.7234,
          accuracy: 10,
        },
      },
    )
    expect(result.inspectionId).toBe(inspectionId)
    expect(result.syncedAt).toBeTruthy()

    const wf = await db.inspectionWorkflow.findUnique({ where: { inspectionId } })
    expect(wf?.geofenceProof).toBeTruthy()
    expect(wf?.unableToEnterComments).toContain('Gate locked')

    const row = await db.permitInspection.findUnique({ where: { id: inspectionId } })
    expect(row?.startGps).toBeTruthy()

    const detail = await inspectionWorkflowService.getAdminDetail(inspectionId)
    expect(detail?.geofenceProof?.latitude).toBeCloseTo(53.6123, 4)
  })
})
