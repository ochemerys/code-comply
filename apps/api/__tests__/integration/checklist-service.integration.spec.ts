import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { integrationDb as db } from '../../src/test-utils/integration-db.js'
import { ChecklistService } from '../../src/services/checklist.service'

describe.sequential('ChecklistService integration (M5-S3)', () => {
  const service = new ChecklistService()
  let inspectionId: string
  let templateId: string
  let versionHash: string

  beforeAll(async () => {
    await db.checklistExecution.deleteMany()
    await db.checklistTemplate.deleteMany()
    await db.inspectionSchedule.deleteMany()
    await db.photo.deleteMany()
    await db.deficiency.deleteMany()
    await db.permitInspection.deleteMany()
    await db.permit.deleteMany()

    const permit = await db.permit.create({
      data: {
        permitNumber: `M5-S3-SVC-${Date.now()}`,
        address: '100 Checklist Service Rd',
        scope: 'Test',
      },
    })

    const inspection = await db.permitInspection.create({
      data: {
        permitId: permit.id,
        scheduledDate: new Date('2026-06-01'),
        status: 'IN_PROGRESS',
      },
    })
    inspectionId = inspection.id

    versionHash = `sha256:m5-s3-${Date.now()}`
    const template = await db.checklistTemplate.create({
      data: {
        name: 'Service test template',
        discipline: 'Building',
        version: 1,
        versionHash,
        items: [
          { id: 'item-a', order: 1, text: 'A', isRequired: true },
          { id: 'item-b', order: 2, text: 'B', isRequired: true },
        ],
        isActive: true,
      },
    })
    templateId = template.id
  })

  afterAll(async () => {
    await db.checklistExecution.deleteMany()
    await db.checklistTemplate.deleteMany()
    await db.inspectionSchedule.deleteMany()
    await db.photo.deleteMany()
    await db.deficiency.deleteMany()
    await db.permitInspection.deleteMany()
    await db.permit.deleteMany()
  })

  beforeEach(async () => {
    await db.checklistExecution.deleteMany()
  })

  it('getTemplate returns persisted template', async () => {
    const t = await service.getTemplate(templateId)
    expect(t.versionHash).toBe(versionHash)
    expect(Array.isArray(t.items as unknown[])).toBe(true)
  })

  it('startExecution pins versionHash and supports updateResponse and getProgress', async () => {
    const exec = await service.startExecution(inspectionId, templateId)
    expect(exec.versionHash).toBe(versionHash)
    expect(exec.progress).toBe(0)

    await service.updateResponse(exec.id, 'item-a', {
      result: 'PASS',
      timestamp: '2026-06-01T10:00:00.000Z',
    })

    let progress = await service.getProgress(exec.id)
    expect(progress).toBe(50)

    await service.updateResponse(exec.id, 'item-b', {
      result: 'FAIL',
      codeReference: { code: 'NBC', section: '9.10.1' },
      timestamp: '2026-06-01T10:01:00.000Z',
    })

    progress = await service.getProgress(exec.id)
    expect(progress).toBe(100)

    const row = await db.checklistExecution.findUnique({ where: { id: exec.id } })
    // All required items answered — execution is marked complete automatically.
    expect(row?.completedAt).toBeInstanceOf(Date)
  })

  it('passAll marks every item PASS', async () => {
    const exec = await service.startExecution(inspectionId, templateId)
    await service.passAll(exec.id)

    const row = await db.checklistExecution.findUnique({ where: { id: exec.id } })
    expect(row?.progress).toBe(100)
    const responses = row?.responses as { itemId: string; result: string }[]
    expect(Array.isArray(responses)).toBe(true)
    expect(responses).toHaveLength(2)
    expect(responses.every((r) => r.result === 'PASS')).toBe(true)
  })

  it('rejects updateResponse on completed execution', async () => {
    const exec = await service.startExecution(inspectionId, templateId)
    await service.passAll(exec.id)

    await db.checklistExecution.update({
      where: { id: exec.id },
      data: { completedAt: new Date('2026-06-01T11:00:00.000Z') },
    })

    await expect(
      service.updateResponse(exec.id, 'item-a', {
        result: 'NA',
        timestamp: '2026-06-01T11:00:00.000Z',
      }),
    ).rejects.toThrow('Cannot modify completed checklist execution')
  })
})
