import { describe, it, expect } from 'vitest'
import { UserMapper } from './user.mapper'
import type { User } from '@prisma/client'

/** M9-S4 columns — intersect so `Partial<…>` accepts overrides even if generated `User` lags schema. */
type UserWithAdminRegistry = User & {
  certificationExpiry: Date | null
  authorities: string[]
  isActive: boolean
  deactivatedAt: Date | null
}

describe('UserMapper', () => {
  const createMockUser = (overrides?: Partial<UserWithAdminRegistry>): User =>
    ({
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      role: 'SCO',
      passwordHash: 'hashed-password',
      certifications: [
        {
          id: 'cert-1',
          discipline: 'Building',
          authority: 'Alberta',
          issuedDate: '2024-01-01T00:00:00Z',
          status: 'ACTIVE',
        },
      ],
      disciplines: ['Building', 'Plumbing'],
      designationId: 'SCO-123',
      lastLoginAt: new Date('2024-01-15T10:00:00Z'),
      certificationExpiry: null,
      authorities: [],
      isActive: true,
      deactivatedAt: null,
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-15T10:00:00Z'),
      ...overrides,
    }) as User

  describe('toDTO', () => {
    it('should map entity to DTO correctly', () => {
      const entity = createMockUser()
      const dto = UserMapper.toDTO(entity)

      expect(dto.id).toBe('user-123')
      expect(dto.email).toBe('test@example.com')
      expect(dto.name).toBe('Test User')
      expect(dto.role).toBe('SCO')
      expect(dto.designationId).toBe('SCO-123')
      expect(dto.disciplines).toEqual(['Building', 'Plumbing'])
      expect(dto.certifications).toHaveLength(1)
      expect(dto.lastLoginAt).toBe('2024-01-15T10:00:00.000Z')
      expect(dto.createdAt).toBe('2024-01-01T00:00:00.000Z')
      expect(dto.updatedAt).toBe('2024-01-15T10:00:00.000Z')
      expect(dto.authorities).toEqual([])
      expect(dto.isActive).toBe(true)
    })

    it('maps M9-S4 admin registry fields', () => {
      const exp = new Date('2026-12-01T12:00:00.000Z')
      const entity = createMockUser({
        certificationExpiry: exp,
        authorities: ['Alberta Municipal Affairs'],
        isActive: false,
        deactivatedAt: new Date('2026-01-02T00:00:00.000Z'),
      })
      const dto = UserMapper.toDTO(entity)
      expect(dto.certificationExpiry).toBe('2026-12-01T12:00:00.000Z')
      expect(dto.authorities).toEqual(['Alberta Municipal Affairs'])
      expect(dto.isActive).toBe(false)
      expect(dto.deactivatedAt).toBe('2026-01-02T00:00:00.000Z')
    })

    it('should handle missing optional fields', () => {
      const entity = createMockUser({
        designationId: null,
        certifications: null,
        lastLoginAt: null,
      })
      const dto = UserMapper.toDTO(entity)

      expect(dto.designationId).toBeUndefined()
      expect(dto.certifications).toBeUndefined()
      expect(dto.lastLoginAt).toBeUndefined()
    })

    it('should handle all user roles', () => {
      const roles = ['SCO', 'ADMIN', 'OWNER']

      roles.forEach((role) => {
        const entity = createMockUser({ role: role as any })
        const dto = UserMapper.toDTO(entity)
        expect(dto.role).toBe(role)
      })
    })

    it('should not include password hash in DTO', () => {
      const entity = createMockUser()
      const dto = UserMapper.toDTO(entity)

      expect(dto).not.toHaveProperty('passwordHash')
    })

    it('should handle empty disciplines array', () => {
      const entity = createMockUser({ disciplines: [] })
      const dto = UserMapper.toDTO(entity)

      expect(dto.disciplines).toEqual([])
    })

    it('should handle empty certifications array', () => {
      const entity = createMockUser({ certifications: [] as any })
      const dto = UserMapper.toDTO(entity)

      expect(dto.certifications).toEqual([])
    })
  })
})
