/**
 * Unit tests for Deficiency model (M6-S1)
 *
 * Covers schema fields, enums, clientId uniqueness, Stop Work / unsafe defaults,
 * and optional checklist linkage.
 */

import { describe, it, expect, afterEach } from 'vitest'
import { PrismaClient, DeficiencySeverity, DeficiencyStatus } from '@prisma/client'

const prisma = new PrismaClient() as PrismaClient & {
  photo: { deleteMany: (args?: { where?: object }) => Promise<unknown> }
}

describe('Deficiency Model (M6-S1)', () => {
  let userId: string | undefined
  let inspectionId: string | undefined

  async function seedUserAndInspection(): Promise<{ userId: string; inspectionId: string }> {
    const user = await prisma.user.create({
      data: {
        email: `def-unit-${Date.now()}@example.com`,
        name: 'Deficiency Unit Test',
        role: 'SCO',
      },
    })
    userId = user.id
    const inspection = await prisma.permitInspection.create({
      data: {
        scheduledDate: new Date('2026-06-15'),
        status: 'IN_PROGRESS',
      },
    })
    inspectionId = inspection.id
    return { userId: user.id, inspectionId: inspection.id }
  }

  afterEach(async () => {
    if (inspectionId) {
      await prisma.photo.deleteMany({ where: { inspectionId } })
      await prisma.deficiency.deleteMany({ where: { inspectionId } })
      await prisma.permitInspection.deleteMany({ where: { id: inspectionId } })
    }
    if (userId) {
      await prisma.user.deleteMany({ where: { id: userId } })
    }
    userId = undefined
    inspectionId = undefined
  })

  it('creates a deficiency with M6-S1 fields and default Stop Work / unsafe flags', async () => {
    const { userId: uid, inspectionId: iid } = await seedUserAndInspection()
    const clientId = `client-m6-${Date.now()}`
    const due = new Date('2026-07-01T12:00:00.000Z')
    const row = await prisma.deficiency.create({
      data: {
        clientId,
        inspectionId: iid,
        createdById: uid,
        description: 'Improper guard on stair opening',
        severity: DeficiencySeverity.CRITICAL,
        status: DeficiencyStatus.OPEN,
        checklistItemId: 'tmpl-item-42',
        dueDate: due,
        codeReference: { code: 'NBC', section: '9.8.8.3' },
      },
    })

    expect(row.checklistItemId).toBe('tmpl-item-42')
    expect(row.dueDate?.toISOString()).toBe(due.toISOString())
    expect(row.isStopWork).toBe(false)
    expect(row.isUnsafe).toBe(false)
    expect(row.severity).toBe(DeficiencySeverity.CRITICAL)
    expect(row.status).toBe(DeficiencyStatus.OPEN)
  })

  it('enforces unique clientId', async () => {
    const { userId: uid, inspectionId: iid } = await seedUserAndInspection()
    const clientId = `dup-client-${Date.now()}`
    await prisma.deficiency.create({
      data: {
        clientId,
        inspectionId: iid,
        createdById: uid,
        description: 'First',
        severity: DeficiencySeverity.MINOR,
      },
    })
    await expect(
      prisma.deficiency.create({
        data: {
          clientId,
          inspectionId: iid,
          createdById: uid,
          description: 'Duplicate clientId',
          severity: DeficiencySeverity.MINOR,
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' })
  })

  it('supports all DeficiencyStatus VOC lifecycle values', async () => {
    const { userId: uid, inspectionId: iid } = await seedUserAndInspection()
    const statuses: DeficiencyStatus[] = [
      DeficiencyStatus.OPEN,
      DeficiencyStatus.VOC_SUBMITTED,
      DeficiencyStatus.VOC_ACCEPTED,
      DeficiencyStatus.VOC_REJECTED,
      DeficiencyStatus.CLOSED,
    ]
    for (let i = 0; i < statuses.length; i++) {
      const s = statuses[i]!
      await prisma.deficiency.create({
        data: {
          clientId: `voc-${Date.now()}-${i}`,
          inspectionId: iid,
          createdById: uid,
          description: `Status ${s}`,
          severity: DeficiencySeverity.MAJOR,
          status: s,
        },
      })
    }
    const count = await prisma.deficiency.count({ where: { inspectionId: iid } })
    expect(count).toBe(statuses.length)
  })

  it('persists Stop Work and unsafe flags', async () => {
    const { userId: uid, inspectionId: iid } = await seedUserAndInspection()
    const row = await prisma.deficiency.create({
      data: {
        clientId: `sw-${Date.now()}`,
        inspectionId: iid,
        createdById: uid,
        description: 'Immediate hazard',
        severity: DeficiencySeverity.CRITICAL,
        isStopWork: true,
        isUnsafe: true,
      },
    })
    expect(row.isStopWork).toBe(true)
    expect(row.isUnsafe).toBe(true)
  })
})
