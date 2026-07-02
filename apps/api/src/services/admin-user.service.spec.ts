import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { PrismaClient, User } from '@codecomply/db'
import { AdminUserService } from './admin-user.service'
import { prisma } from '@codecomply/db'

/** Prisma `user.update` returns a fluent client, not a bare `Promise<User>`. */
type UserUpdateReturn = ReturnType<PrismaClient['user']['update']>

type UserWithLifecycle = User & {
  isActive: boolean
  deactivatedAt: Date | null
}

vi.mock('@codecomply/db', () => ({
  prisma: {
    user: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}))

describe('AdminUserService', () => {
  let service: AdminUserService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new AdminUserService()
  })

  describe('list', () => {
    it('returns users with default filters and pagination', async () => {
      vi.mocked(prisma.user.findMany).mockResolvedValueOnce([])
      const result = await service.list()
      expect(result).toEqual([])
      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: {},
        select: expect.objectContaining({ id: true, email: true }),
        orderBy: { createdAt: 'desc' },
        take: 50,
        skip: 0,
      })
    })

    it('applies role and isActive filters', async () => {
      vi.mocked(prisma.user.findMany).mockResolvedValueOnce([])
      await service.list({ role: 'ADMIN', isActive: true, page: 2, pageSize: 10 })
      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: { role: 'ADMIN', isActive: true },
        select: expect.any(Object),
        orderBy: { createdAt: 'desc' },
        take: 10,
        skip: 10,
      })
    })

    it('applies search filter with pagination', async () => {
      vi.mocked(prisma.user.findMany).mockResolvedValueOnce([])
      await service.list({ search: '  jane  ' })
      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { email: { contains: 'jane', mode: 'insensitive' } },
            { name: { contains: 'jane', mode: 'insensitive' } },
          ],
        },
        select: expect.any(Object),
        orderBy: { createdAt: 'desc' },
        take: 50,
        skip: 0,
      })
    })
  })

  describe('getById', () => {
    it('delegates to prisma with selective fields', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null)
      await expect(service.getById('u1')).resolves.toBeNull()
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'u1' },
        select: expect.objectContaining({ id: true, email: true }),
      })
    })
  })

  describe('update', () => {
    it('throws when user missing', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null)
      await expect(service.update('missing', { name: 'X' })).rejects.toThrow('User not found')
    })

    it('updates allowed fields', async () => {
      const existing = { id: 'u1' } as any
      const updated = { id: 'u1', name: 'New' } as any
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(existing)
      vi.mocked(prisma.user.update).mockResolvedValueOnce(updated)

      const result = await service.update('u1', {
        name: 'New',
        designationId: 'D-1',
        disciplines: ['Building'],
        authorities: ['AB'],
        certificationExpiry: new Date('2028-01-01T00:00:00.000Z'),
      })

      expect(result.name).toBe('New')
      expect(prisma.user.update).toHaveBeenCalled()
    })
  })

  describe('updateCertifications', () => {
    it('throws when user missing', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null)
      await expect(service.updateCertifications('x', [])).rejects.toThrow('User not found')
    })

    it('persists certifications json', async () => {
      const existing = { id: 'u1' } as any
      const certs = [
        {
          id: 'c1',
          discipline: 'Building',
          authority: 'AB',
          issuedDate: '2024-01-01T00:00:00.000Z',
          status: 'ACTIVE' as const,
        },
      ]
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(existing)
      vi.mocked(prisma.user.update).mockResolvedValueOnce({
        ...existing,
        certifications: certs,
      } as any)

      await service.updateCertifications('u1', certs)
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'u1' },
          data: { certifications: certs },
        }),
      )
    })
  })

  describe('deactivate / reactivate', () => {
    it('deactivate throws when missing', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null)
      await expect(service.deactivate('x')).rejects.toThrow('User not found')
    })

    it('deactivate sets flags', async () => {
      const existing = { id: 'u1' } as any
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(existing)
      vi.mocked(prisma.user.update).mockImplementation(
        ({ data }) => Promise.resolve({ ...existing, ...data }) as unknown as UserUpdateReturn,
      )

      const row = (await service.deactivate('u1')) as UserWithLifecycle
      expect(row.isActive).toBe(false)
      expect(row.deactivatedAt).toBeInstanceOf(Date)
    })

    it('reactivate clears deactivation', async () => {
      const existing = { id: 'u1', isActive: false } as any
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(existing)
      vi.mocked(prisma.user.update).mockImplementation(
        ({ data }) => Promise.resolve({ ...existing, ...data }) as unknown as UserUpdateReturn,
      )

      const row = (await service.reactivate('u1')) as UserWithLifecycle
      expect(row.isActive).toBe(true)
      expect(row.deactivatedAt).toBeNull()
    })
  })
})
