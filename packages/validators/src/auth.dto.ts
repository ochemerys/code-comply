import { z } from 'zod'

// Login DTO
export const LoginDTOSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

export type LoginDTO = z.infer<typeof LoginDTOSchema>

// Token DTO
export const TokenDTOSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number(),
})

export type TokenDTO = z.infer<typeof TokenDTOSchema>

// Refresh Token DTO
export const RefreshTokenDTOSchema = z.object({
  refreshToken: z.string(),
})

export type RefreshTokenDTO = z.infer<typeof RefreshTokenDTOSchema>

/** M-01: certification revocation status for session restore */
export const CertificationStatusDTOSchema = z.object({
  revoked: z.boolean(),
  revokedAt: z.string().datetime().optional(),
  reasonCode: z.enum(['USER_DEACTIVATED', 'CERTIFICATION_REVOKED']).optional(),
})

export type CertificationStatusDTO = z.infer<typeof CertificationStatusDTOSchema>

/** Public SSO/OIDC config for inspector login (M-01). */
export const SsoPublicConfigSchema = z.object({
  enabled: z.boolean(),
  clientId: z.string().optional(),
  authorizationEndpoint: z.string().url().optional(),
  scopes: z.array(z.string()).optional(),
  /** True when the API hosts a development OIDC provider (local verification). */
  devProvider: z.boolean().optional(),
})

export type SsoPublicConfig = z.infer<typeof SsoPublicConfigSchema>

export const SsoTokenExchangeSchema = z.object({
  code: z.string().min(1),
  redirectUri: z.string().url(),
  state: z.string().min(1),
})

export type SsoTokenExchange = z.infer<typeof SsoTokenExchangeSchema>
