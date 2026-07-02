/**
 * M10-S5: VerificationOfCompliance (VoC) — one row per deficiency, review workflow.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prismaForVocIntegrationTests } from '../helpers/test-prisma.js'

const prisma = prismaForVocIntegrationTests()

describe('VerificationOfCompliance (M10-S5)', () => {
  let userId: string
  let reviewerId: string
  let inspectionId: string
  let deficiencyId: string
  let vocId: string

  beforeAll(async () => {
    const author = await prisma.user.create({
      data: {
        email: `voc-int-author-${Date.now()}@example.com`,
        name: 'VoC Author',
        role: 'SCO',
      },
    })
    userId = author.id

    const reviewer = await prisma.user.create({
      data: {
        email: `voc-int-reviewer-${Date.now()}@example.com`,
        name: 'VoC Reviewer',
        role: 'ADMIN',
      },
    })
    reviewerId = reviewer.id

    const inspection = await prisma.permitInspection.create({
      data: {
        scheduledDate: new Date('2026-11-01'),
        status: 'IN_PROGRESS',
        notes: 'M10-S5 VoC integration',
      },
    })
    inspectionId = inspection.id

    const deficiency = await prisma.deficiency.create({
      data: {
        clientId: `voc-def-${Date.now()}`,
        inspectionId,
        createdById: userId,
        description: 'Gap at stair',
        severity: 'MAJOR',
      },
    })
    deficiencyId = deficiency.id

    const voc = await prisma.verificationOfCompliance.create({
      data: {
        deficiencyId,
        verificationDate: new Date('2026-11-02'),
        sectionTitle: 'Division B — Safety',
        title: 'Guardrail corrected',
        name: 'Building Owner LLC',
        method: 'SITE_VISIT',
        comments: 'Verified on site with photos on file.',
        submittedAt: new Date('2026-11-03T10:00:00.000Z'),
        status: 'PENDING',
      },
    })
    vocId = voc.id
  })

  afterAll(async () => {
    await prisma.deficiency.deleteMany({ where: { id: deficiencyId } })
    await prisma.permitInspection.deleteMany({ where: { id: inspectionId } })
    await prisma.user.deleteMany({ where: { id: { in: [userId, reviewerId] } } })
    await prisma.$disconnect()
  })

  it('links to deficiency and stores verification details', async () => {
    const row = (await prisma.verificationOfCompliance.findUniqueOrThrow({
      where: { id: vocId },
      include: { deficiency: true },
    })) as {
      deficiencyId: string
      method: string
      sectionTitle: string
      deficiency: { description: string }
    }
    expect(row.deficiencyId).toBe(deficiencyId)
    expect(row.method).toBe('SITE_VISIT')
    expect(row.sectionTitle.length).toBeGreaterThan(0)
    expect(row.deficiency.description).toContain('stair')
  })

  it('tracks review status and reviewer', async () => {
    await prisma.verificationOfCompliance.update({
      where: { id: vocId },
      data: {
        status: 'ACCEPTED',
        reviewedAt: new Date('2026-11-04T14:00:00.000Z'),
        reviewedById: reviewerId,
      },
    })
    const row = (await prisma.verificationOfCompliance.findUniqueOrThrow({
      where: { id: vocId },
      include: { reviewedBy: true },
    })) as {
      status: string
      reviewedBy: { id: string } | null
    }
    expect(row.status).toBe('ACCEPTED')
    expect(row.reviewedBy?.id).toBe(reviewerId)
  })

  it('resolves VoC by deficiency id (one-to-one)', async () => {
    const voc = await prisma.verificationOfCompliance.findUnique({
      where: { deficiencyId },
    })
    expect(voc?.id).toBe(vocId)
  })
})
