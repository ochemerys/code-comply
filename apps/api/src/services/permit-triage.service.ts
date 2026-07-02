import { prisma } from '@codecomply/db'
import type {
  PermitStatus,
  PermitTriageDetailDTO,
  PermitTriageSummary,
} from '@codecomply/validators'
import { PermitMapper } from '../mappers/permit.mapper.js'
import { permitService } from './permit.service.js'

export function isMissingLld(legalLandDesc?: string | null): boolean {
  return !legalLandDesc?.trim()
}

export function computePermitTriage(
  permit: { status: PermitStatus; legalLandDesc?: string | null },
  stopWorkLockedOut: boolean,
): PermitTriageSummary {
  const missingLld = isMissingLld(permit.legalLandDesc)
  const inactive = permit.status === 'CANCELLED' || permit.status === 'EXPIRED'
  const blockReasons: string[] = []
  const guidance: string[] = []

  if (permit.status === 'CANCELLED') {
    blockReasons.push('Cancelled permit')
    guidance.push(
      'Do not assign — cancelled permits are not eligible for preparation or assignment.',
    )
  } else if (permit.status === 'EXPIRED') {
    blockReasons.push('Expired permit')
    guidance.push('Close the file — expired permits cannot be assigned to a new inspection.')
  }

  if (missingLld && permit.status === 'ACTIVE') {
    blockReasons.push('Missing legal land description')
    guidance.push(
      'Confirm the legal land description with the municipality before assigning an inspection.',
    )
  }

  if (stopWorkLockedOut && permit.status === 'ACTIVE') {
    blockReasons.push('Active Stop Work order')
    guidance.push(
      'Assignment is locked until a Senior SCO overrides the Stop Work order or clearance is recorded.',
    )
  }

  const assignmentEligible =
    permit.status === 'ACTIVE' && !inactive && !missingLld && !stopWorkLockedOut

  return { missingLld, stopWorkLockedOut, assignmentEligible, blockReasons, guidance }
}

export class PermitTriageService {
  async findLockedStopWorkPermitIds(permitIds: string[]): Promise<Set<string>> {
    if (permitIds.length === 0) return new Set()

    const rows = await prisma.deficiency.findMany({
      where: {
        isStopWork: true,
        status: 'OPEN',
        inspection: { permitId: { in: permitIds } },
        stopWorkEscalation: { lockedOut: true },
      },
      select: { inspection: { select: { permitId: true } } },
    })

    return new Set(
      rows
        .map((row) => row.inspection.permitId)
        .filter((permitId): permitId is string => permitId != null),
    )
  }

  async getTriageDetail(permitId: string): Promise<PermitTriageDetailDTO | null> {
    const permit = await permitService.getById(permitId)
    if (!permit) return null

    const locked = await this.findLockedStopWorkPermitIds([permitId])
    const triage = computePermitTriage(permit, locked.has(permitId))

    return {
      ...PermitMapper.toDTO(permit),
      triage,
    }
  }

  async buildTriageSummariesForPermits(
    permits: Array<{ id: string; status: PermitStatus; legalLandDesc?: string | null }>,
  ): Promise<Map<string, PermitTriageSummary>> {
    const locked = await this.findLockedStopWorkPermitIds(permits.map((p) => p.id))
    const summaries = new Map<string, PermitTriageSummary>()

    for (const permit of permits) {
      summaries.set(permit.id, computePermitTriage(permit, locked.has(permit.id)))
    }

    return summaries
  }
}

export const permitTriageService = new PermitTriageService()
