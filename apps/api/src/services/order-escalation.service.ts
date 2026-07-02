import { prisma } from '@codecomply/db'
import type { Prisma, User } from '@codecomply/db'
import type { AdminOrderEmailDelivery, AdminOrdersSummaryDTO } from '@codecomply/validators'
import { APPEAL_DEADLINE_DAYS } from '@codecomply/validators'
import { OrderMapper } from '../mappers/order.mapper.js'
import { AUDIT_ACTION, AUDIT_ENTITY, auditLogService } from './audit-log.service.js'
import { distributionService } from './distribution.service.js'
import { getSmsService, resolveSeniorScoPhone } from '../lib/sms/sms-service.js'

const deficiencyInclude = {
  stopWorkEscalation: true,
  createdBy: { select: { id: true, name: true } },
  inspection: {
    include: {
      permit: { select: { permitNumber: true, address: true } },
      schedule: { include: { assignedTo: { select: { name: true } } } },
    },
  },
} satisfies Prisma.DeficiencyInclude

export function computeAppealDeadline(servedAt: Date): Date {
  const deadline = new Date(servedAt)
  deadline.setUTCDate(deadline.getUTCDate() + APPEAL_DEADLINE_DAYS)
  return deadline
}

/** Senior SCO may override lock-out (authorities tag or env allow-list). */
export function isSeniorSco(user: Pick<User, 'id' | 'authorities'>): boolean {
  if (user.authorities.some((a) => /senior\s*sco/i.test(a))) {
    return true
  }
  const ids =
    process.env.SENIOR_SCO_USER_IDS?.split(',')
      .map((s) => s.trim())
      .filter(Boolean) ?? []
  return ids.includes(user.id)
}

export class OrderEscalationService {
  async onStopWorkIssued(payload: {
    deficiencyId: string
    inspectionId: string
    issuedByUserId?: string
  }): Promise<void> {
    const deficiency = await prisma.deficiency.findUnique({
      where: { id: payload.deficiencyId },
      include: {
        inspection: {
          include: {
            permit: true,
            schedule: { include: { assignedTo: true } },
          },
        },
      },
    })
    if (!deficiency) return

    const servedAt = new Date()
    const appealDeadline = computeAppealDeadline(servedAt)

    const emailDeliveries: AdminOrderEmailDelivery[] = []
    let smsDeliveredAt: Date | undefined
    let smsDeliveryLog: string | undefined

    const userId =
      payload.issuedByUserId ??
      deficiency.createdById ??
      deficiency.inspection.schedule?.assignedToId ??
      deficiency.createdById

    try {
      const batch = await distributionService.distributeForInspection(
        payload.inspectionId,
        userId,
        'manual',
        true,
      )
      for (const result of batch.results) {
        if (result.kind === 'stop-work-order' && result.status === 'sent') {
          emailDeliveries.push({
            recipient: 'applicant,owner',
            status: 'sent',
            sentAt: new Date().toISOString(),
            messageId: result.messageId,
          })
        }
      }
    } catch (error) {
      console.error('[OrderEscalation] Section 49 email distribution failed:', error)
      emailDeliveries.push({
        recipient: 'applicant,owner',
        status: 'failed',
        sentAt: new Date().toISOString(),
      })
    }

    const seniorPhone = resolveSeniorScoPhone()
    if (seniorPhone) {
      try {
        const permitNumber = deficiency.inspection.permit?.permitNumber ?? 'N/A'
        const sms = await getSmsService().sendUrgent(
          seniorPhone,
          `URGENT: Stop Work Order issued. Permit: ${permitNumber}. View in admin portal.`,
        )
        smsDeliveredAt = new Date(sms.sentAt)
        smsDeliveryLog = sms.providerMessageId
      } catch (error) {
        console.error('[OrderEscalation] Senior SCO SMS failed:', error)
      }
    }

    await prisma.stopWorkEscalation.upsert({
      where: { deficiencyId: payload.deficiencyId },
      create: {
        deficiencyId: payload.deficiencyId,
        servedAt,
        appealDeadline,
        lockedOut: true,
        emailDeliveries: emailDeliveries as Prisma.InputJsonValue,
        smsDeliveredAt,
        smsDeliveryLog,
      },
      update: {
        servedAt,
        appealDeadline,
        lockedOut: true,
        emailDeliveries: emailDeliveries as Prisma.InputJsonValue,
        smsDeliveredAt,
        smsDeliveryLog,
      },
    })

    await auditLogService.append({
      entityType: AUDIT_ENTITY.DEFICIENCY,
      entityId: payload.deficiencyId,
      action: AUDIT_ACTION.DEFICIENCY_UPDATED,
      userId,
      beforeData: null,
      afterData: { stopWorkEscalation: true, servedAt: servedAt.toISOString() },
      metadata: {
        inspectionId: payload.inspectionId,
        reason: 'stop_work_escalation',
        appealDeadline: appealDeadline.toISOString(),
      },
    })
  }

  async listActiveAlerts() {
    const rows = await prisma.deficiency.findMany({
      where: {
        OR: [{ isStopWork: true }, { isUnsafe: true }],
        status: { not: 'CLOSED' },
      },
      include: deficiencyInclude,
      orderBy: { updatedAt: 'desc' },
      take: 50,
    })
    return rows.map((row) => OrderMapper.toAlertListItem(row))
  }

  async getSummary(): Promise<AdminOrdersSummaryDTO> {
    const recentAlerts = await this.listActiveAlerts()
    return {
      activeStopWorkCount: recentAlerts.filter((a) => a.orderType === 'STOP_WORK').length,
      recentAlerts: recentAlerts.slice(0, 5),
    }
  }

  async getDetail(deficiencyId: string) {
    const row = await prisma.deficiency.findUnique({
      where: { id: deficiencyId },
      include: {
        ...deficiencyInclude,
        stopWorkEscalation: { include: { lockOutOverriddenBy: { select: { name: true } } } },
      },
    })
    if (!row || (!row.isStopWork && !row.isUnsafe)) {
      throw new Error('Order not found')
    }

    const report = await prisma.report.findFirst({
      where: { inspectionId: row.inspectionId, type: 'STOP_WORK' },
      orderBy: { generatedAt: 'desc' },
      select: { id: true },
    })

    const audits = await auditLogService.listForEntity(AUDIT_ENTITY.DEFICIENCY, deficiencyId)
    const auditTrail = audits.slice(0, 20).map((entry) => ({
      at: entry.timestamp.toISOString(),
      action: entry.action,
      detail:
        typeof entry.metadata === 'object' && entry.metadata !== null
          ? JSON.stringify(entry.metadata)
          : undefined,
    }))

    const detail = OrderMapper.toDetail(row, report?.id, auditTrail)
    if (row.stopWorkEscalation?.lockOutOverriddenBy) {
      detail.lockOutOverriddenByName = row.stopWorkEscalation.lockOutOverriddenBy.name
    }
    return detail
  }

  async overrideLockOut(
    deficiencyId: string,
    userId: string,
    reason: string,
  ): Promise<{ lockedOut: boolean }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, authorities: true, name: true },
    })
    if (!user || user.role !== 'ADMIN') {
      throw new Error('Forbidden')
    }
    if (!isSeniorSco(user)) {
      throw new Error('Senior SCO approval required to override lock-out')
    }

    const row = await prisma.deficiency.findUnique({
      where: { id: deficiencyId },
      include: { stopWorkEscalation: true },
    })
    if (!row?.isStopWork && !row?.isUnsafe) {
      throw new Error('Order not found')
    }
    if (!row.stopWorkEscalation) {
      throw new Error('Escalation record not found')
    }
    if (!row.stopWorkEscalation.lockedOut) {
      return { lockedOut: false }
    }

    const now = new Date()
    await prisma.stopWorkEscalation.update({
      where: { deficiencyId },
      data: {
        lockedOut: false,
        lockOutOverriddenAt: now,
        lockOutOverriddenById: userId,
        lockOutOverrideReason: reason,
      },
    })

    await auditLogService.append({
      entityType: AUDIT_ENTITY.DEFICIENCY,
      entityId: deficiencyId,
      action: AUDIT_ACTION.DEFICIENCY_UPDATED,
      userId,
      beforeData: { lockedOut: true },
      afterData: { lockedOut: false, lockOutOverrideReason: reason },
      metadata: { reason: 'senior_sco_lockout_override', actorName: user.name },
    })

    return { lockedOut: false }
  }
}

export const orderEscalationService = new OrderEscalationService()
