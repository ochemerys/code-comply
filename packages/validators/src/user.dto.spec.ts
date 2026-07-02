import { describe, it, expect } from 'vitest'
import { UserDTOSchema, UserRoleSchema } from './user.dto'

describe('UserDTOSchema', () => {
  it('should validate a valid user', () => {
    const validUser = {
      id: 'clx1234567890',
      email: 'inspector@example.com',
      name: 'Jane Smith',
      role: 'SCO' as const,
      disciplines: [],
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    }

    const result = UserDTOSchema.safeParse(validUser)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.authorities).toBeUndefined()
      expect(result.data.isActive).toBeUndefined()
    }
  })

  it('accepts M9-S4 registry fields when present', () => {
    const withRegistry = {
      id: 'clx1234567890',
      email: 'inspector@example.com',
      name: 'Jane Smith',
      role: 'SCO' as const,
      disciplines: ['Building'],
      authorities: ['AB'],
      isActive: false,
      certificationExpiry: '2025-06-01T00:00:00.000Z',
      deactivatedAt: undefined,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    }
    const result = UserDTOSchema.safeParse(withRegistry)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.authorities).toEqual(['AB'])
      expect(result.data.isActive).toBe(false)
      expect(result.data.certificationExpiry).toBe('2025-06-01T00:00:00.000Z')
    }
  })

  it('should reject invalid email', () => {
    const invalidUser = {
      id: 'clx1234567890',
      email: 'not-an-email',
      name: 'Jane Smith',
      role: 'SCO' as const,
      disciplines: [],
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    }

    const result = UserDTOSchema.safeParse(invalidUser)
    expect(result.success).toBe(false)
  })

  it('should reject empty name', () => {
    const invalidUser = {
      id: 'clx1234567890',
      email: 'inspector@example.com',
      name: '',
      role: 'SCO' as const,
      disciplines: [],
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    }

    const result = UserDTOSchema.safeParse(invalidUser)
    expect(result.success).toBe(false)
  })

  it('should reject invalid role', () => {
    const invalidUser = {
      id: 'clx1234567890',
      email: 'inspector@example.com',
      name: 'Jane Smith',
      role: 'INVALID_ROLE',
      disciplines: [],
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    }

    const result = UserDTOSchema.safeParse(invalidUser)
    expect(result.success).toBe(false)
  })
})

describe('UserRoleSchema', () => {
  it('should accept valid roles', () => {
    expect(UserRoleSchema.safeParse('SCO').success).toBe(true)
    expect(UserRoleSchema.safeParse('ADMIN').success).toBe(true)
    expect(UserRoleSchema.safeParse('OWNER').success).toBe(true)
  })

  it('should reject invalid roles', () => {
    expect(UserRoleSchema.safeParse('inspector').success).toBe(false)
    expect(UserRoleSchema.safeParse('admin').success).toBe(false)
    expect(UserRoleSchema.safeParse('').success).toBe(false)
  })
})
