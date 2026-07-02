import { z } from 'zod'
import { CertificationDTOSchema, UserRoleSchema } from './user.dto.js'

// ============================================================================
// Admin create user (A-01)
// ============================================================================

export const AdminCreateUserBodySchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  role: UserRoleSchema.default('SCO'),
  designationId: z.string().min(1).optional(),
  disciplines: z.array(z.string()).default([]),
  authorities: z.array(z.string()).default([]),
  certificationExpiry: z.string().datetime().optional(),
  certifications: z.array(CertificationDTOSchema).default([]),
  /** When omitted, the API generates a one-time temporary password. */
  initialPassword: z.string().min(8).optional(),
})

export type AdminCreateUserBody = z.infer<typeof AdminCreateUserBodySchema>

export const AdminCreateUserResponseSchema = z.object({
  user: z.object({
    id: z.string(),
    email: z.string().email(),
    name: z.string(),
    role: UserRoleSchema,
  }),
  /** Present only when the server generated a temporary password. */
  temporaryPassword: z.string().optional(),
})

export type AdminCreateUserResponse = z.infer<typeof AdminCreateUserResponseSchema>

// ============================================================================
// SSO / session settings (A-01)
// ============================================================================

export const AdminSsoSettingsSchema = z.object({
  enabled: z.boolean(),
  issuerUrl: z.string().url().or(z.literal('')),
  clientId: z.string(),
  redirectUris: z.array(z.string().url()),
  /** True when SSO_CLIENT_SECRET is configured on the server (value never exposed). */
  clientSecretConfigured: z.boolean(),
  documentationUrl: z.string().url().optional(),
})

export type AdminSsoSettings = z.infer<typeof AdminSsoSettingsSchema>

export const AdminSsoSettingsPatchSchema = z.object({
  enabled: z.boolean().optional(),
  issuerUrl: z.string().url().or(z.literal('')).optional(),
  clientId: z.string().optional(),
  redirectUris: z.array(z.string().url()).optional(),
})

export type AdminSsoSettingsPatch = z.infer<typeof AdminSsoSettingsPatchSchema>

export const AdminSessionPolicySchema = z.object({
  idleWarnAfterMinutes: z.number().positive(),
  idleLogoutAfterMinutes: z.number().positive(),
  source: z.enum(['server', 'client']),
})

export type AdminSessionPolicy = z.infer<typeof AdminSessionPolicySchema>

// ============================================================================
// Inspection certification snapshot (A-01 legal record)
// ============================================================================

export const InspectionCertificationSnapshotSchema = z.object({
  inspectionId: z.string(),
  finalizedAt: z.string().datetime().optional(),
  snapshot: z.unknown().nullable(),
  snapshotHash: z.string().nullable(),
})

export type InspectionCertificationSnapshot = z.infer<typeof InspectionCertificationSnapshotSchema>
