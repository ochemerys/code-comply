/**
 * M10-S7: Addendum model — amendments linked to inspections with reason, content, signature, timestamp.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

describe('Addendum model (M10-S7)', () => {
  let authorId: string
  let inspectionId: string
  let addendumId: string

  beforeAll(async () => {
    const author = await prisma.user.create({
      data: {
        email: `addendum-int-${Date.now()}@example.com`,
        name: 'Addendum Author',
        role: 'SCO',
      },
    })
    authorId = author.id

    const inspection = await prisma.permitInspection.create({
      data: {
        scheduledDate: new Date('2026-11-10T09:00:00.000Z'),
        status: 'PASSED',
        finalizedAt: new Date('2026-11-10T11:00:00.000Z'),
        notes: 'M10-S7 addendum integration',
      },
    })
    inspectionId = inspection.id

    const addendum = await prisma.addendum.create({
      data: {
        inspectionId,
        reason: 'Correct permit number on cover sheet',
        content: 'Permit number was transcribed as P-2024-099; correct value is P-2024-009.',
        createdById: authorId,
        signature: 'data:image/png;base64,iVBORw0KGgo=',
      },
    })
    addendumId = addendum.id
  })

  afterAll(async () => {
    await prisma.addendum.deleteMany({ where: { inspectionId } })
    await prisma.permitInspection.deleteMany({ where: { id: inspectionId } })
    await prisma.user.deleteMany({ where: { id: authorId } })
    await prisma.$disconnect()
  })

  it('links to inspection and stores amendment fields', async () => {
    const row = await prisma.addendum.findUniqueOrThrow({
      where: { id: addendumId },
      include: { inspection: true, createdBy: true },
    })
    expect(row.inspectionId).toBe(inspectionId)
    expect(row.reason).toContain('permit number')
    expect(row.content.length).toBeGreaterThan(10)
    expect(row.signature).toContain('base64')
    expect(row.createdBy.id).toBe(authorId)
    expect(row.inspection.notes).toContain('M10-S7')
  })

  it('is timestamped at creation', async () => {
    const row = await prisma.addendum.findUniqueOrThrow({ where: { id: addendumId } })
    expect(row.createdAt).toBeInstanceOf(Date)
    expect(row.createdAt.getTime()).toBeLessThanOrEqual(Date.now())
  })

  it('lists under the original inspection', async () => {
    const inspection = await prisma.permitInspection.findUniqueOrThrow({
      where: { id: inspectionId },
      include: { addendums: true },
    })
    expect(inspection.addendums.some((a) => a.id === addendumId)).toBe(true)
  })
})
