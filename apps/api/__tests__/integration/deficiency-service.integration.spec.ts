import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { integrationDb as db } from '../../src/test-utils/integration-db.js'
import {
  DeficiencyService,
  deficiencyNotificationHooks,
} from '../../src/services/deficiency.service.js'

describe.sequential('DeficiencyService integration (M6-S3)', () => {
  const service = new DeficiencyService()
  let inspectorId: string
  let otherId: string
  let inspectionId: string
  let permitId: string
  let clientId: string

  beforeAll(async () => {
    const inspector = await db.user.create({
      data: {
        email: `m6-s3-def-svc-insp-${Date.now()}@example.com`,
        name: 'M6 S3 Inspector',
        role: 'SCO',
      },
    })
    inspectorId = inspector.id

    const other = await db.user.create({
      data: {
        email: `m6-s3-def-svc-other-${Date.now()}@example.com`,
        name: 'M6 S3 Other',
        role: 'SCO',
      },
    })
    otherId = other.id

    const permit = await db.permit.create({
      data: {
        permitNumber: `M6-S3-DEF-${Date.now()}`,
        address: '200 Deficiency Ln',
        scope: 'Test',
      },
    })
    permitId = permit.id

    const inspection = await db.permitInspection.create({
      data: {
        permitId,
        scheduledDate: new Date('2026-07-01'),
        status: 'IN_PROGRESS',
        notes: 'M6-S3 deficiency service integration',
      },
    })
    inspectionId = inspection.id

    await db.inspectionSchedule.create({
      data: {
        inspectionId,
        assignedToId: inspectorId,
      },
    })

    clientId = `m6-s3-cli-${Date.now()}`
  })

  afterAll(async () => {
    await db.photo.deleteMany({ where: { inspectionId } })
    await db.deficiency.deleteMany({ where: { inspectionId } })
    await db.inspectionSchedule.deleteMany({ where: { inspectionId } })
    await db.permitInspection.deleteMany({ where: { id: inspectionId } })
    await db.permit.deleteMany({ where: { id: permitId } })
    await db.user.deleteMany({
      where: { id: { in: [inspectorId, otherId] } },
    })
  })

  beforeEach(async () => {
    await db.photo.deleteMany({ where: { inspectionId } })
    await db.deficiency.deleteMany({ where: { inspectionId } })
    vi.restoreAllMocks()
  })

  it('create deduplicates by clientId', async () => {
    const dto = {
      clientId,
      inspectionId,
      description: 'First write at least ten characters',
      severity: 'MAJOR' as const,
      isStopWork: false,
      isUnsafe: false,
    }
    const a = await service.create(dto, inspectorId)
    const b = await service.create(dto, inspectorId)
    expect(a.id).toBe(b.id)
    const rows = await db.deficiency.findMany({ where: { inspectionId } })
    expect(rows).toHaveLength(1)
  })

  it('getById enforces assignment', async () => {
    const row = await service.create(
      {
        clientId: `${clientId}-g`,
        inspectionId,
        description: 'Access control ten chars',
        severity: 'MINOR',
        isStopWork: false,
        isUnsafe: false,
      },
      inspectorId,
    )

    await expect(service.getById(row.id, otherId)).rejects.toThrow('Unauthorized')

    const got = await service.getById(row.id, inspectorId)
    expect(got?.id).toBe(row.id)
  })

  it('list filters by inspection and assignment', async () => {
    await service.create(
      {
        clientId: `${clientId}-l1`,
        inspectionId,
        description: 'List filter one ten chars',
        severity: 'MAJOR',
        isStopWork: false,
        isUnsafe: false,
      },
      inspectorId,
    )
    await service.create(
      {
        clientId: `${clientId}-l2`,
        inspectionId,
        description: 'List filter two ten chars',
        severity: 'CRITICAL',
        isStopWork: true,
        isUnsafe: false,
      },
      inspectorId,
    )

    const critical = await service.list({
      userId: inspectorId,
      inspectionId,
      severity: 'CRITICAL',
    })
    expect(critical).toHaveLength(1)
    expect(critical[0].severity).toBe('CRITICAL')
  })

  it('update respects ETag', async () => {
    const row = await service.create(
      {
        clientId: `${clientId}-e`,
        inspectionId,
        description: 'Etag test ten charss',
        severity: 'MINOR',
        isStopWork: false,
        isUnsafe: false,
      },
      inspectorId,
    )
    const fresh = await db.deficiency.findUniqueOrThrow({ where: { id: row.id } })

    await expect(
      service.update(row.id, inspectorId, { description: 'Updated text ten chars' }, 'wrong-etag'),
    ).rejects.toThrow('Optimistic concurrency conflict')

    const updated = await service.update(
      row.id,
      inspectorId,
      { description: 'Updated text ten chars' },
      fresh.etag ?? undefined,
    )
    expect(updated.description).toBe('Updated text ten chars')
  })

  it('createStopWorkOrder notifies and sets flag', async () => {
    const notify = vi
      .spyOn(deficiencyNotificationHooks, 'onStopWorkOrderIssued')
      .mockResolvedValue()
    const row = await service.create(
      {
        clientId: `${clientId}-sw`,
        inspectionId,
        description: 'Stop work case ten chars',
        severity: 'MAJOR',
        isStopWork: false,
        isUnsafe: false,
      },
      inspectorId,
    )

    const swo = await service.createStopWorkOrder(row.id, inspectorId)
    expect(swo.deficiencyId).toBe(row.id)
    expect(notify).toHaveBeenCalled()

    const persisted = await db.deficiency.findUniqueOrThrow({ where: { id: row.id } })
    expect(persisted.isStopWork).toBe(true)
  })

  it('delete removes row when permitted', async () => {
    const row = await service.create(
      {
        clientId: `${clientId}-d`,
        inspectionId,
        description: 'Delete case ten charss',
        severity: 'MINOR',
        isStopWork: false,
        isUnsafe: false,
      },
      inspectorId,
    )

    await service.delete(row.id, inspectorId)
    const gone = await db.deficiency.findUnique({ where: { id: row.id } })
    expect(gone).toBeNull()
  })
})
