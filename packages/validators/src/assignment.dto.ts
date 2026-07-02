import { z } from 'zod'
import { CertificationDTOSchema, UserRoleSchema } from './user.dto.js'
import { ScoDailyAvailabilitySchema } from './sco-readiness.js'

// ============================================================================
// Admin user list / patch (M9-S7)
// ============================================================================

export const AdminUserListQuerySchema = z.object({
  role: UserRoleSchema.optional(),
  isActive: z
    .string()
    .optional()
    .transform((s) => {
      if (s === undefined || s === '') return undefined
      if (s === 'true' || s === '1') return true
      if (s === 'false' || s === '0') return false
      return undefined
    }),
  search: z.string().optional(),
})

export type AdminUserListQuery = z.infer<typeof AdminUserListQuerySchema>

export const AdminPatchUserBodySchema = z.object({
  name: z.string().min(1).optional(),
  designationId: z.string().nullable().optional(),
  disciplines: z.array(z.string()).optional(),
  authorities: z.array(z.string()).optional(),
  certificationExpiry: z.string().datetime().nullable().optional(),
})

export type AdminPatchUserBody = z.infer<typeof AdminPatchUserBodySchema>

export const AdminUserCertificationsBodySchema = z.object({
  certifications: z.array(CertificationDTOSchema),
})

export type AdminUserCertificationsBody = z.infer<typeof AdminUserCertificationsBodySchema>

// ============================================================================
// Assignments & workload (M9-S7)
// ============================================================================

export const AssignmentDTOSchema = z.object({
  id: z.string(),
  inspectionId: z.string(),
  assignedToId: z.string(),
  assignedDate: z.string().datetime(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type AssignmentDTO = z.infer<typeof AssignmentDTOSchema>

export const AdminAssignmentCreateBodySchema = z.object({
  inspectionId: z.string().min(1),
  userId: z.string().min(1),
  /** When set, updates the inspection scheduled date (grid/calendar placement). */
  scheduledDate: z.string().datetime().optional(),
})

export type AdminAssignmentCreateBody = z.infer<typeof AdminAssignmentCreateBodySchema>

export const AdminBulkAssignmentBodySchema = z.object({
  items: z.array(
    z.object({
      inspectionId: z.string().min(1),
      userId: z.string().min(1),
    }),
  ),
})

export type AdminBulkAssignmentBody = z.infer<typeof AdminBulkAssignmentBodySchema>

export const AdminWorkloadQuerySchema = z.object({
  userId: z.string().min(1),
  from: z.string().datetime(),
  to: z.string().datetime(),
})

export type AdminWorkloadQuery = z.infer<typeof AdminWorkloadQuerySchema>

export const WorkloadInspectionItemDTOSchema = z.object({
  inspectionId: z.string(),
  scheduledDate: z.string().datetime(),
  status: z.string(),
})

export const WorkloadDTOSchema = z.object({
  userId: z.string(),
  scheduledCount: z.number().int().nonnegative(),
  inspections: z.array(WorkloadInspectionItemDTOSchema),
})

export type WorkloadDTO = z.infer<typeof WorkloadDTOSchema>

// ============================================================================
// Admin assignment grid & calendar (A-02)
// ============================================================================

export const AdminAssignmentGridQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

export type AdminAssignmentGridQuery = z.infer<typeof AdminAssignmentGridQuerySchema>

export const AdminGridInspectorSchema = z.object({
  id: z.string(),
  name: z.string(),
  disciplines: z.array(z.string()).optional(),
})

export const AdminGridInspectionItemSchema = z.object({
  id: z.string(),
  inspectionId: z.string(),
  permitId: z.string(),
  label: z.string(),
  /** Permit scope shown on assignment tiles (e.g. "New Construction"). */
  description: z.string(),
  /** Inferred from permit scope for discipline matching (A-01). */
  discipline: z.string().nullable().optional(),
})

export const AdminGridDailyLoadSchema = ScoDailyAvailabilitySchema.extend({
  inspectorId: z.string(),
  isoDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

export const AdminGridAssignmentItemSchema = AdminGridInspectionItemSchema.extend({
  inspectorId: z.string(),
  isoDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

export const AdminAssignmentGridDTOSchema = z.object({
  inspectors: z.array(AdminGridInspectorSchema),
  unassigned: z.array(AdminGridInspectionItemSchema),
  assignments: z.array(AdminGridAssignmentItemSchema),
  maxAssignmentsPerDay: z.number().int().positive(),
  dailyLoads: z.array(AdminGridDailyLoadSchema),
})

export type AdminAssignmentGridDTO = z.infer<typeof AdminAssignmentGridDTOSchema>

export const AdminCalendarWorkloadQuerySchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
})

export type AdminCalendarWorkloadQuery = z.infer<typeof AdminCalendarWorkloadQuerySchema>

export const AdminCalendarWorkloadEventSchema = z.object({
  id: z.string(),
  inspectionId: z.string(),
  permitId: z.string(),
  title: z.string(),
  start: z.string().datetime(),
  inspectorId: z.string(),
  status: z.string(),
})

export const AdminCalendarWorkloadDTOSchema = z.object({
  inspectors: z.array(AdminGridInspectorSchema),
  events: z.array(AdminCalendarWorkloadEventSchema),
})

export type AdminCalendarWorkloadDTO = z.infer<typeof AdminCalendarWorkloadDTOSchema>
