import { z } from 'zod'

export const APPEAL_DEADLINE_DAYS = 14

export const AdminOrderEmailDeliverySchema = z.object({
  recipient: z.string(),
  status: z.enum(['queued', 'sent', 'failed', 'opened']),
  sentAt: z.string().datetime().optional(),
  openedAt: z.string().datetime().optional(),
  messageId: z.string().optional(),
})

export type AdminOrderEmailDelivery = z.infer<typeof AdminOrderEmailDeliverySchema>

export const AdminOrderAlertListItemSchema = z.object({
  id: z.string(),
  deficiencyId: z.string(),
  inspectionId: z.string(),
  orderType: z.enum(['STOP_WORK', 'UNSAFE_CONDITION']),
  permitNumber: z.string(),
  location: z.string().optional(),
  inspectorName: z.string(),
  issuedAt: z.string().datetime(),
  lockedOut: z.boolean(),
  appealDeadline: z.string().datetime(),
  appealDaysRemaining: z.number().int(),
})

export type AdminOrderAlertListItemDTO = z.infer<typeof AdminOrderAlertListItemSchema>

export const AdminOrderDetailSchema = z.object({
  id: z.string(),
  deficiencyId: z.string(),
  inspectionId: z.string(),
  orderType: z.enum(['STOP_WORK', 'UNSAFE_CONDITION']),
  permitNumber: z.string(),
  location: z.string().optional(),
  address: z.string().optional(),
  inspectorName: z.string(),
  description: z.string(),
  servedAt: z.string().datetime(),
  appealDeadline: z.string().datetime(),
  appealDaysRemaining: z.number().int(),
  lockedOut: z.boolean(),
  lockOutOverriddenAt: z.string().datetime().optional(),
  lockOutOverriddenByName: z.string().optional(),
  lockOutOverrideReason: z.string().optional(),
  emailDeliveries: z.array(AdminOrderEmailDeliverySchema),
  smsDeliveredAt: z.string().datetime().optional(),
  smsDeliveryLog: z.string().optional(),
  section49ReportId: z.string().optional(),
  auditTrail: z.array(
    z.object({
      at: z.string().datetime(),
      action: z.string(),
      actorName: z.string().optional(),
      detail: z.string().optional(),
    }),
  ),
})

export type AdminOrderDetailDTO = z.infer<typeof AdminOrderDetailSchema>

export const AdminOrdersSummarySchema = z.object({
  activeStopWorkCount: z.number().int(),
  recentAlerts: z.array(AdminOrderAlertListItemSchema),
})

export type AdminOrdersSummaryDTO = z.infer<typeof AdminOrdersSummarySchema>

export const AdminOrderOverrideLockOutBodySchema = z.object({
  reason: z.string().min(10).max(2000),
})

export type AdminOrderOverrideLockOutBody = z.infer<typeof AdminOrderOverrideLockOutBodySchema>

export const AdminInspectionMonitorRowSchema = z.object({
  id: z.string(),
  permitId: z.string(),
  status: z.enum(['IN_PROGRESS', 'REVIEW', 'PENDING_SUBMISSION', 'SUBMITTED', 'COMPLETED']),
  inspectorName: z.string(),
  syncStatus: z.enum(['SYNCED', 'SYNCING', 'OFFLINE']),
  pendingSubmission: z.boolean(),
  stopWorkAlert: z.boolean(),
  updatedAt: z.string().datetime(),
})

export const AdminInspectionMonitorPayloadSchema = z.object({
  inspections: z.array(AdminInspectionMonitorRowSchema),
  generatedAt: z.string().datetime(),
})

export type AdminInspectionMonitorPayloadDTO = z.infer<typeof AdminInspectionMonitorPayloadSchema>

export const AdminDashboardStatsSchema = z.object({
  activeInspectors: z.number().int(),
  pendingInspections: z.number().int(),
  completedToday: z.number().int(),
  stopWorkOrders: z.number().int(),
})

export const AdminDashboardPayloadSchema = z.object({
  stats: AdminDashboardStatsSchema,
  recentInspections: z.array(
    z.object({
      id: z.string(),
      permitId: z.string(),
      status: z.string(),
      inspectorName: z.string(),
      updatedAt: z.string().datetime(),
    }),
  ),
  pendingAssignments: z.array(
    z.object({
      id: z.string(),
      permitId: z.string(),
      assignedTo: z.string(),
      dueDate: z.string().datetime(),
    }),
  ),
  stopWorkAlerts: z.array(AdminOrderAlertListItemSchema),
})

export type AdminDashboardPayloadDTO = z.infer<typeof AdminDashboardPayloadSchema>
