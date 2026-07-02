import { z } from 'zod'

// ============================================================================
// User DTOs
// ============================================================================

export const UserRoleSchema = z.enum(['SCO', 'ADMIN', 'OWNER'])

// Certification DTO
export const CertificationDTOSchema = z.object({
  id: z.string(),
  discipline: z.string(),
  authority: z.string(),
  issuedDate: z.string().datetime(),
  expiryDate: z.string().datetime().optional(),
  status: z.enum(['ACTIVE', 'EXPIRED', 'REVOKED']),
})

export type CertificationDTO = z.infer<typeof CertificationDTOSchema>

// User DTO (public profile)
export const UserDTOSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().min(1),
  role: UserRoleSchema,
  designationId: z.string().optional(),
  disciplines: z.array(z.string()),
  certifications: z.array(CertificationDTOSchema).optional(),
  lastLoginAt: z.string().datetime().optional(),
  /** M9-S4: optional for older cached profiles; API / DB layer should supply values when available */
  certificationExpiry: z.string().datetime().optional(),
  authorities: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
  deactivatedAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type UserRole = z.infer<typeof UserRoleSchema>
export type UserDTO = z.infer<typeof UserDTOSchema>
