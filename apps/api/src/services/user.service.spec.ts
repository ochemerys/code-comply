import { describe, it, expect, beforeEach, vi } from 'vitest'
import { UserService } from './user.service'
import { prisma } from '@codecomply/db'

vi.mock('@codecomply/db', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}))

describe('UserService', () => {
  let userService: UserService

  beforeEach(() => {
    userService = new UserService()
    vi.clearAllMocks()
  })

  describe('getById', () => {
    it('should return user by ID', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'SCO',
      }

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)

      const result = await userService.getById('user-1')

      expect(result).toEqual(mockUser)
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
      })
    })

    it('should return null if user not found', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

      const result = await userService.getById('non-existent')

      expect(result).toBeNull()
    })
  })

  describe('getCertifications', () => {
    it('should return user certifications', async () => {
      const mockCertifications = [
        {
          id: 'cert-1',
          discipline: 'Building',
          authority: 'Alberta',
          issuedDate: '2024-01-01T00:00:00Z',
          status: 'ACTIVE',
        },
      ]

      const mockUser = {
        certifications: mockCertifications,
      }

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)

      const result = await userService.getCertifications('user-1')

      expect(result).toEqual(mockCertifications)
    })

    it('should return empty array if no certifications', async () => {
      const mockUser = {
        certifications: null,
      }

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)

      const result = await userService.getCertifications('user-1')

      expect(result).toEqual([])
    })

    it('should return empty array if user not found', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

      const result = await userService.getCertifications('non-existent')

      expect(result).toEqual([])
    })
  })

  describe('snapshotCertification', () => {
    it('should create certification snapshot', async () => {
      const mockUser = {
        id: 'user-1',
        name: 'Test User',
        designationId: 'SCO-123',
        disciplines: ['Building', 'Plumbing'],
        certifications: [
          {
            id: 'cert-1',
            discipline: 'Building',
            authority: 'Alberta',
            issuedDate: '2024-01-01T00:00:00Z',
            status: 'ACTIVE',
          },
        ],
      }

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)

      const result = await userService.snapshotCertification('user-1')

      expect(result).toHaveProperty('userId', 'user-1')
      expect(result).toHaveProperty('name', 'Test User')
      expect(result).toHaveProperty('designationId', 'SCO-123')
      expect(result).toHaveProperty('disciplines')
      expect(result).toHaveProperty('certifications')
      expect(result).toHaveProperty('snapshotAt')
    })

    it('should throw error if user not found', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

      await expect(userService.snapshotCertification('non-existent')).rejects.toThrow(
        'User not found',
      )
    })
  })
})
