/**
 * Integration tests for Deficiency model (M6-S1)
 *
 * Query patterns for field inspections: Stop Work filtering, checklist linkage, severity.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { DeficiencySeverity } from '@prisma/client'
import { prismaForDbTests } from '../helpers/test-prisma.js'

const prisma = prismaForDbTests()

describe('Deficiency Integration Tests (M6-S1)', () => {
  let userId: string
  let inspectionId: string

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        email: `def-int-${Date.now()}@example.com`,
        name: 'Deficiency Integration',
        role: 'SCO',
      },
    })
    userId = user.id
    const inspection = await prisma.permitInspection.create({
      data: {
        scheduledDate: new Date('2026-08-01'),
        status: 'IN_PROGRESS',
      },
    })
    inspectionId = inspection.id

    await prisma.deficiency.createMany({
      data: [
        {
          clientId: `int-sw-1-${Date.now()}`,
          inspectionId,
          createdById: userId,
          description: 'Stop work A',
          severity: DeficiencySeverity.CRITICAL,
          isStopWork: true,
          checklistItemId: 'chk-a',
        },
        {
          clientId: `int-sw-2-${Date.now()}`,
          inspectionId,
          createdById: userId,
          description: 'Stop work B',
          severity: DeficiencySeverity.MAJOR,
          isStopWork: true,
          checklistItemId: 'chk-b',
        },
        {
          clientId: `int-no-sw-${Date.now()}`,
          inspectionId,
          createdById: userId,
          description: 'Minor note',
          severity: DeficiencySeverity.MINOR,
          isStopWork: false,
        },
      ],
    })
  })

  afterAll(async () => {
    await prisma.photo.deleteMany({ where: { inspectionId } })
    await prisma.deficiency.deleteMany({ where: { inspectionId } })
    await prisma.permitInspection.deleteMany({ where: { id: inspectionId } })
    await prisma.user.deleteMany({ where: { id: userId } })
    await prisma.$disconnect()
  })

  it('finds Stop Work deficiencies for an inspection', async () => {
    const rows = await prisma.deficiency.findMany({
      where: { inspectionId, isStopWork: true },
      orderBy: { description: 'asc' },
    })
    expect(rows).toHaveLength(2)
    expect(rows.every((r) => r.isStopWork)).toBe(true)
  })

  it('finds deficiencies linked to a checklist item id', async () => {
    const rows = await prisma.deficiency.findMany({
      where: { inspectionId, checklistItemId: 'chk-a' },
    })
    expect(rows).toHaveLength(1)
    expect(rows[0]!.description).toBe('Stop work A')
  })

  it('aggregates critical deficiencies including Stop Work', async () => {
    const criticalStop = await prisma.deficiency.count({
      where: {
        inspectionId,
        severity: DeficiencySeverity.CRITICAL,
        isStopWork: true,
      },
    })
    expect(criticalStop).toBe(1)
  })
})
