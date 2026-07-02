/**
 * Integration tests for checklist workflow (M5-S1): template → execution on inspection
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prismaForDbTests } from '../helpers/test-prisma.js'

const prisma = prismaForDbTests()

describe('Checklist integration (M5-S1)', () => {
  let permitId: string
  let inspectionId: string
  let templateId: string
  let versionHash: string

  beforeAll(async () => {
    await prisma.checklistExecution.deleteMany()
    await prisma.checklistTemplate.deleteMany()
    await prisma.codeLibrary.deleteMany()
    await prisma.inspectionSchedule.deleteMany()
    await prisma.photo.deleteMany()
    await prisma.deficiency.deleteMany()
    await prisma.permitInspection.deleteMany()
    await prisma.permit.deleteMany()

    const permit = await prisma.permit.create({
      data: {
        permitNumber: 'M5-S1-INT-001',
        address: '500 Integration Rd, Edmonton, AB',
        scope: 'Commercial',
      },
    })
    permitId = permit.id

    const inspection = await prisma.permitInspection.create({
      data: {
        permitId,
        scheduledDate: new Date('2026-05-15'),
        status: 'IN_PROGRESS',
      },
    })
    inspectionId = inspection.id

    versionHash = 'sha256:int-template-v1'
    const template = await prisma.checklistTemplate.create({
      data: {
        name: 'Part 9 — Housing',
        discipline: 'Building',
        version: 1,
        versionHash,
        items: [
          { id: 'a', label: 'Structural', order: 1 },
          { id: 'b', label: 'Fire safety', order: 2 },
        ],
        isActive: true,
      },
    })
    templateId = template.id

    await prisma.codeLibrary.createMany({
      data: [
        { code: 'ABC', section: '4.1.1', title: 'General' },
        { code: 'ABC', section: '4.1.2', title: 'Specific' },
      ],
    })
  })

  afterAll(async () => {
    await prisma.checklistExecution.deleteMany()
    await prisma.checklistTemplate.deleteMany()
    await prisma.codeLibrary.deleteMany()
    await prisma.inspectionSchedule.deleteMany()
    await prisma.photo.deleteMany()
    await prisma.deficiency.deleteMany()
    await prisma.permitInspection.deleteMany()
    await prisma.permit.deleteMany()
    await prisma.$disconnect()
  })

  it('creates execution pinned to template versionHash', async () => {
    const execution = await prisma.checklistExecution.create({
      data: {
        inspectionId,
        templateId,
        versionHash,
        responses: {},
        progress: 0,
      },
    })

    expect(execution.versionHash).toBe(versionHash)
  })

  it('queries active templates by discipline', async () => {
    const active = await prisma.checklistTemplate.findMany({
      where: { discipline: 'Building', isActive: true },
    })
    expect(active.some((t) => t.id === templateId)).toBe(true)
  })

  it('finds code library entries by section prefix pattern', async () => {
    const rows = await prisma.codeLibrary.findMany({
      where: { section: { startsWith: '4.1' } },
      orderBy: { section: 'asc' },
    })
    expect(rows).toHaveLength(2)
    expect(rows[0].code).toBe('ABC')
  })

  it('lists executions for an inspection with template metadata', async () => {
    const list = await prisma.checklistExecution.findMany({
      where: { inspectionId },
      include: { template: true },
    })

    expect(list.length).toBeGreaterThanOrEqual(1)
    expect(list[0].template.discipline).toBe('Building')
  })

  it('updates progress and completedAt', async () => {
    const exec = await prisma.checklistExecution.findFirst({
      where: { inspectionId },
    })
    expect(exec).toBeDefined()

    const done = new Date('2026-05-20T16:00:00Z')
    const updated = await prisma.checklistExecution.update({
      where: { id: exec!.id },
      data: { progress: 1, completedAt: done, responses: { a: 'PASS', b: 'PASS' } },
    })

    expect(updated.progress).toBe(1)
    expect(updated.completedAt?.getTime()).toBe(done.getTime())
  })
})
