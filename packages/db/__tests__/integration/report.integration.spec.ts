/**
 * M10-S4: Report model — metadata for generated PDFs (storage key, hash, distribution).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

describe('Report model (M10-S4)', () => {
  let inspectionId: string
  let reportId: string

  beforeAll(async () => {
    const inspection = await prisma.permitInspection.create({
      data: {
        scheduledDate: new Date('2026-09-15T12:00:00.000Z'),
        status: 'PASSED',
        notes: 'M10-S4 report integration',
      },
    })
    inspectionId = inspection.id

    const report = await prisma.report.create({
      data: {
        inspectionId,
        type: 'INSPECTION',
        filename: 'inspection-summary.pdf',
        storageKey: `documents/reports/${inspectionId}/inspection-summary.pdf`,
        hash: 'a'.repeat(64),
      },
    })
    reportId = report.id
  })

  afterAll(async () => {
    await prisma.report.deleteMany({ where: { inspectionId } })
    await prisma.permitInspection.deleteMany({ where: { id: inspectionId } })
    await prisma.$disconnect()
  })

  it('links to inspection and stores R2 key + hash', async () => {
    const row = await prisma.report.findUniqueOrThrow({
      where: { id: reportId },
      include: { inspection: true },
    })
    expect(row.inspectionId).toBe(inspectionId)
    expect(row.type).toBe('INSPECTION')
    expect(row.storageKey).toContain(inspectionId)
    expect(row.hash).toHaveLength(64)
    expect(row.inspection.notes).toContain('M10-S4')
    expect(row.distributedAt).toBeNull()
  })

  it('tracks distribution timestamp', async () => {
    const when = new Date('2026-09-16T08:00:00.000Z')
    await prisma.report.update({
      where: { id: reportId },
      data: { distributedAt: when },
    })
    const row = await prisma.report.findUniqueOrThrow({ where: { id: reportId } })
    expect(row.distributedAt?.toISOString()).toBe(when.toISOString())
  })

  it('supports all ReportType enum values', async () => {
    const types = ['DEFICIENCY', 'NO_ENTRY', 'STOP_WORK'] as const
    const createdIds: string[] = []
    for (const type of types) {
      const r = await prisma.report.create({
        data: {
          inspectionId,
          type,
          filename: `${type.toLowerCase()}.pdf`,
          storageKey: `documents/reports/${inspectionId}/${type}.pdf`,
          hash: 'b'.repeat(64),
        },
      })
      createdIds.push(r.id)
    }
    const rows = await prisma.report.findMany({
      where: { id: { in: createdIds } },
    })
    expect(rows).toHaveLength(3)
    expect(new Set(rows.map((r) => r.type))).toEqual(new Set(types))

    await prisma.report.deleteMany({ where: { id: { in: createdIds } } })
  })
})
