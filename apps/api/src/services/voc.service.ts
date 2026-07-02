import { prisma } from '@codecomply/db'
import type { VerificationOfCompliance } from '@codecomply/db'
import type { SubmitVoCDTO, VoCDecision } from '@codecomply/validators'

export type VoC = VerificationOfCompliance

const SUBMITTABLE_DEFICIENCY_STATUSES = new Set(['OPEN', 'VOC_REJECTED'])

function mapSubmitData(data: SubmitVoCDTO) {
  return {
    verificationDate: new Date(data.verificationDate),
    sectionTitle: data.sectionTitle,
    title: data.title,
    name: data.name,
    method: data.method,
    comments: data.comments ?? null,
  }
}

/**
 * Verification of Compliance domain service — submission, admin review, deficiency resolution (M10-S6).
 */
export class VoCService {
  async submit(deficiencyId: string, data: SubmitVoCDTO): Promise<VoC> {
    const deficiency = await prisma.deficiency.findUnique({
      where: { id: deficiencyId },
      include: { verificationOfCompliance: true },
    })
    if (!deficiency) {
      throw new Error('Deficiency not found')
    }

    if (!SUBMITTABLE_DEFICIENCY_STATUSES.has(deficiency.status)) {
      if (deficiency.status === 'VOC_SUBMITTED') {
        throw new Error('VoC already submitted and pending review')
      }
      throw new Error('Deficiency is not eligible for VoC submission')
    }

    const existing = deficiency.verificationOfCompliance
    const submittedAt = new Date()
    const vocFields = mapSubmitData(data)

    if (existing) {
      if (existing.status === 'PENDING') {
        throw new Error('VoC already submitted and pending review')
      }
      if (existing.status === 'ACCEPTED') {
        throw new Error('VoC already accepted')
      }

      return prisma.$transaction(async (tx) => {
        const voc = await tx.verificationOfCompliance.update({
          where: { id: existing.id },
          data: {
            ...vocFields,
            submittedAt,
            status: 'PENDING',
            reviewedAt: null,
            reviewedById: null,
          },
        })

        await tx.deficiency.update({
          where: { id: deficiencyId },
          data: {
            status: 'VOC_SUBMITTED',
            vocSubmittedAt: submittedAt,
            vocRejectedAt: null,
            vocNotes: data.comments ?? null,
          },
        })

        return voc
      })
    }

    return prisma.$transaction(async (tx) => {
      const voc = await tx.verificationOfCompliance.create({
        data: {
          deficiencyId,
          ...vocFields,
          submittedAt,
          status: 'PENDING',
        },
      })

      await tx.deficiency.update({
        where: { id: deficiencyId },
        data: {
          status: 'VOC_SUBMITTED',
          vocSubmittedAt: submittedAt,
          vocNotes: data.comments ?? null,
        },
      })

      return voc
    })
  }

  async review(
    vocId: string,
    decision: VoCDecision,
    reviewerId: string,
    comments?: string,
  ): Promise<VoC> {
    const reviewer = await prisma.user.findUnique({
      where: { id: reviewerId },
      select: { role: true },
    })
    if (!reviewer || reviewer.role !== 'ADMIN') {
      throw new Error('Forbidden: only admins can review VoC')
    }

    const existing = await prisma.verificationOfCompliance.findUnique({
      where: { id: vocId },
    })
    if (!existing) {
      throw new Error('VoC not found')
    }
    if (existing.status !== 'PENDING') {
      throw new Error('VoC is not pending review')
    }

    const reviewedAt = new Date()

    return prisma.$transaction(async (tx) => {
      const voc = await tx.verificationOfCompliance.update({
        where: { id: vocId },
        data: {
          status: decision,
          reviewedAt,
          reviewedById: reviewerId,
        },
      })

      await tx.deficiency.update({
        where: { id: existing.deficiencyId },
        data:
          decision === 'ACCEPTED'
            ? {
                status: 'CLOSED',
                vocAcceptedAt: reviewedAt,
                ...(comments !== undefined ? { vocNotes: comments } : {}),
              }
            : {
                status: 'VOC_REJECTED',
                vocRejectedAt: reviewedAt,
                ...(comments !== undefined ? { vocNotes: comments } : {}),
              },
      })

      return voc
    })
  }

  async getByDeficiency(deficiencyId: string): Promise<VoC | null> {
    return prisma.verificationOfCompliance.findUnique({
      where: { deficiencyId },
    })
  }

  async listPending(
    reviewerId: string,
    options?: { page?: number; pageSize?: number },
  ): Promise<VoC[]> {
    const reviewer = await prisma.user.findUnique({
      where: { id: reviewerId },
      select: { role: true },
    })
    if (!reviewer || reviewer.role !== 'ADMIN') {
      throw new Error('Forbidden: only admins can list pending VoC')
    }

    const pageSize = Math.min(Math.max(options?.pageSize ?? 50, 1), 200)
    const page = Math.max(options?.page ?? 1, 1)

    return prisma.verificationOfCompliance.findMany({
      where: { status: 'PENDING' },
      orderBy: { submittedAt: 'asc' },
      take: pageSize,
      skip: (page - 1) * pageSize,
      select: {
        id: true,
        deficiencyId: true,
        verificationDate: true,
        sectionTitle: true,
        title: true,
        name: true,
        method: true,
        comments: true,
        submittedAt: true,
        reviewedAt: true,
        reviewedById: true,
        status: true,
      },
    }) as Promise<VoC[]>
  }
}

export const vocService = new VoCService()
