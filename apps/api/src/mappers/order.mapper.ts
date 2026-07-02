import type { Deficiency, Permit, PermitInspection, StopWorkEscalation, User } from '@codecomply/db'
import type {
  AdminOrderAlertListItemDTO,
  AdminOrderDetailDTO,
  AdminOrderEmailDelivery,
} from '@codecomply/validators'
import { APPEAL_DEADLINE_DAYS } from '@codecomply/validators'

type DeficiencyWithContext = Deficiency & {
  stopWorkEscalation: StopWorkEscalation | null
  createdBy: Pick<User, 'id' | 'name'>
  inspection: PermitInspection & {
    permit: Pick<Permit, 'permitNumber' | 'address'> | null
    schedule: { assignedTo: Pick<User, 'name'> | null } | null
  }
}

function appealDaysRemaining(appealDeadline: Date, now = new Date()): number {
  const ms = appealDeadline.getTime() - now.getTime()
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)))
}

function parseEmailDeliveries(raw: unknown): AdminOrderEmailDelivery[] {
  if (!Array.isArray(raw)) return []
  return raw.filter(
    (row): row is AdminOrderEmailDelivery =>
      typeof row === 'object' &&
      row !== null &&
      typeof (row as AdminOrderEmailDelivery).recipient === 'string' &&
      typeof (row as AdminOrderEmailDelivery).status === 'string',
  )
}

export class OrderMapper {
  static toAlertListItem(row: DeficiencyWithContext): AdminOrderAlertListItemDTO {
    const servedAt = row.stopWorkEscalation?.servedAt ?? row.updatedAt
    const appealDeadline =
      row.stopWorkEscalation?.appealDeadline ??
      new Date(servedAt.getTime() + APPEAL_DEADLINE_DAYS * 24 * 60 * 60 * 1000)

    return {
      id: row.stopWorkEscalation?.id ?? `swo-${row.id}`,
      deficiencyId: row.id,
      inspectionId: row.inspectionId,
      orderType: row.isStopWork ? 'STOP_WORK' : 'UNSAFE_CONDITION',
      permitNumber: row.inspection.permit?.permitNumber ?? '—',
      location: row.location ?? undefined,
      inspectorName: row.inspection.schedule?.assignedTo?.name ?? row.createdBy.name ?? 'Unknown',
      issuedAt: servedAt.toISOString(),
      lockedOut: row.stopWorkEscalation?.lockedOut ?? true,
      appealDeadline: appealDeadline.toISOString(),
      appealDaysRemaining: appealDaysRemaining(appealDeadline),
    }
  }

  static toDetail(
    row: DeficiencyWithContext,
    section49ReportId: string | undefined,
    auditTrail: AdminOrderDetailDTO['auditTrail'],
  ): AdminOrderDetailDTO {
    const alert = OrderMapper.toAlertListItem(row)
    const esc = row.stopWorkEscalation

    return {
      ...alert,
      address: row.inspection.permit?.address ?? undefined,
      description: row.description,
      servedAt: alert.issuedAt,
      lockOutOverriddenAt: esc?.lockOutOverriddenAt?.toISOString(),
      lockOutOverriddenByName: undefined,
      lockOutOverrideReason: esc?.lockOutOverrideReason ?? undefined,
      emailDeliveries: parseEmailDeliveries(esc?.emailDeliveries),
      smsDeliveredAt: esc?.smsDeliveredAt?.toISOString(),
      smsDeliveryLog: esc?.smsDeliveryLog ?? undefined,
      section49ReportId,
      auditTrail,
    }
  }
}
