import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { AuthService } from './auth.service'
import { prisma } from '@codecomply/db'
import * as bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'

vi.mock('@codecomply/db', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    session: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}))

vi.mock('bcrypt', () => ({
  default: {
    compare: vi.fn(),
    hash: vi.fn(),
  },
  compare: vi.fn(),
  hash: vi.fn(),
}))

vi.mock('jsonwebtoken', () => ({
  default: {
    sign: vi.fn(),
    verify: vi.fn(),
  },
}))

vi.mock('crypto', () => ({
  default: {
    randomUUID: vi.fn(() => 'mock-session-id'),
  },
  randomUUID: vi.fn(() => 'mock-session-id'),
}))

describe('AuthService', () => {
  let authService: AuthService

  beforeEach(() => {
    authService = new AuthService()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('login', () => {
    it('should authenticate user with valid credentials', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        passwordHash: 'hashed-password',
        role: 'SCO',
        name: 'Test User',
        disciplines: [],
        certifications: null,
        designationId: null,
        lastLoginAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never)
      vi.mocked(jwt.sign).mockReturnValue('mock-token' as any)
      vi.mocked(prisma.user.update).mockResolvedValue(mockUser as any)
      vi.mocked(prisma.session.deleteMany).mockResolvedValue({ count: 0 } as any)
      vi.mocked(prisma.session.create).mockResolvedValue({} as any)

      const result = await authService.login({
        email: 'test@example.com',
        password: 'password123',
      })

      expect(result).toHaveProperty('accessToken')
      expect(result).toHaveProperty('refreshToken')
      expect(result).toHaveProperty('expiresIn')
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { lastLoginAt: expect.any(Date) },
      })
    })

    it('should clean up old sessions before creating new one', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        passwordHash: 'hashed-password',
        role: 'SCO',
        name: 'Test User',
        disciplines: [],
        certifications: null,
        designationId: null,
        lastLoginAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never)
      vi.mocked(jwt.sign).mockReturnValue('mock-token' as any)
      vi.mocked(prisma.user.update).mockResolvedValue(mockUser as any)
      vi.mocked(prisma.session.deleteMany).mockResolvedValue({ count: 2 } as any)
      vi.mocked(prisma.session.create).mockResolvedValue({} as any)

      await authService.login({
        email: 'test@example.com',
        password: 'password123',
      })

      // Verify old sessions are deleted
      expect(prisma.session.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      })
      // Verify new session is created
      expect(prisma.session.create).toHaveBeenCalled()
      // Verify deleteMany was called (cleaning up old sessions)
      expect(vi.mocked(prisma.session.deleteMany).mock.calls.length).toBe(1)
    })

    it('should generate tokens with session ID', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        passwordHash: 'hashed-password',
        role: 'SCO',
        name: 'Test User',
        disciplines: [],
        certifications: null,
        designationId: null,
        lastLoginAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never)
      vi.mocked(jwt.sign).mockReturnValue('mock-token' as any)
      vi.mocked(prisma.user.update).mockResolvedValue(mockUser as any)
      vi.mocked(prisma.session.deleteMany).mockResolvedValue({ count: 0 } as any)
      vi.mocked(prisma.session.create).mockResolvedValue({} as any)

      await authService.login({
        email: 'test@example.com',
        password: 'password123',
      })

      // Verify JWT sign is called with sessionId
      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          role: 'SCO',
          sessionId: 'mock-session-id',
        }),
        expect.any(String),
        expect.any(Object),
      )

      // Verify session is created with explicit ID
      expect(prisma.session.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id: 'mock-session-id',
          userId: 'user-1',
        }),
      })
    })

    it('should handle jwt.sign being a function (regression test)', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        passwordHash: 'hashed-password',
        role: 'SCO',
        name: 'Test User',
        disciplines: [],
        certifications: null,
        designationId: null,
        lastLoginAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never)
      vi.mocked(prisma.user.update).mockResolvedValue(mockUser as any)
      vi.mocked(prisma.session.deleteMany).mockResolvedValue({ count: 0 } as any)
      vi.mocked(prisma.session.create).mockResolvedValue({} as any)

      // Verify jwt.sign is a function
      expect(typeof jwt.sign).toBe('function')

      // Mock jwt.sign to return tokens
      vi.mocked(jwt.sign).mockReturnValue('mock-token' as any)

      const result = await authService.login({
        email: 'test@example.com',
        password: 'password123',
      })

      // Should not throw "jwt.sign is not a function"
      expect(result).toBeDefined()
      expect(jwt.sign).toHaveBeenCalled()
    })

    it('should throw error with invalid credentials', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

      await expect(
        authService.login({
          email: 'test@example.com',
          password: 'wrong',
        }),
      ).rejects.toThrow('Invalid credentials')
    })

    it('should throw error when password does not match', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        passwordHash: 'hashed-password',
        role: 'SCO',
      }

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never)

      await expect(
        authService.login({
          email: 'test@example.com',
          password: 'wrong-password',
        }),
      ).rejects.toThrow('Invalid credentials')
    })
  })

  describe('validateToken', () => {
    it('should return user for valid token', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        role: 'SCO',
        name: 'Test User',
      }

      const mockSession = {
        id: 'session-1',
        userId: 'user-1',
        token: 'valid-token',
        expiresAt: new Date(Date.now() + 1000000),
        user: mockUser,
      }

      vi.mocked(jwt.verify).mockReturnValue({ userId: 'user-1', sessionId: 'session-1' } as any)
      vi.mocked(prisma.session.findUnique).mockResolvedValue(mockSession as any)

      const result = await authService.validateToken('valid-token')

      expect(result).toBeDefined()
      expect(result?.id).toBe('user-1')
    })

    it('should use session ID from JWT for lookup', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        role: 'SCO',
        name: 'Test User',
      }

      const mockSession = {
        id: 'session-123',
        userId: 'user-1',
        token: 'valid-token',
        expiresAt: new Date(Date.now() + 1000000),
        user: mockUser,
      }

      vi.mocked(jwt.verify).mockReturnValue({ userId: 'user-1', sessionId: 'session-123' } as any)
      vi.mocked(prisma.session.findUnique).mockResolvedValue(mockSession as any)

      await authService.validateToken('valid-token')

      // Verify session is looked up by ID, not token
      expect(prisma.session.findUnique).toHaveBeenCalledWith({
        where: { id: 'session-123' },
        include: { user: true },
      })
    })

    it('should return null if session userId does not match token userId', async () => {
      const mockSession = {
        id: 'session-1',
        userId: 'user-2', // Different user
        token: 'valid-token',
        expiresAt: new Date(Date.now() + 1000000),
        user: { id: 'user-2' },
      }

      vi.mocked(jwt.verify).mockReturnValue({ userId: 'user-1', sessionId: 'session-1' } as any)
      vi.mocked(prisma.session.findUnique).mockResolvedValue(mockSession as any)

      const result = await authService.validateToken('valid-token')

      expect(result).toBeNull()
    })

    it('should return null for invalid token', async () => {
      vi.mocked(jwt.verify).mockImplementation(() => {
        throw new Error('Invalid token')
      })

      const result = await authService.validateToken('invalid-token')

      expect(result).toBeNull()
    })

    it('should return null for expired session', async () => {
      const mockSession = {
        id: 'session-1',
        userId: 'user-1',
        token: 'valid-token',
        expiresAt: new Date(Date.now() - 1000000), // Expired
        user: { id: 'user-1' },
      }

      vi.mocked(jwt.verify).mockReturnValue({ userId: 'user-1', sessionId: 'session-1' } as any)
      vi.mocked(prisma.session.findUnique).mockResolvedValue(mockSession as any)

      const result = await authService.validateToken('valid-token')

      expect(result).toBeNull()
    })

    it('should return null if session not found', async () => {
      vi.mocked(jwt.verify).mockReturnValue({ userId: 'user-1', sessionId: 'session-1' } as any)
      vi.mocked(prisma.session.findUnique).mockResolvedValue(null)

      const result = await authService.validateToken('valid-token')

      expect(result).toBeNull()
    })
  })

  describe('refreshToken', () => {
    it('should generate new token pair with valid refresh token', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        role: 'SCO',
        name: 'Test User',
        disciplines: [],
        certifications: null,
        designationId: null,
        lastLoginAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const mockSession = {
        id: 'session-1',
        refreshToken: 'valid-refresh-token',
        expiresAt: new Date(Date.now() + 1000000),
        user: mockUser,
      }

      vi.mocked(jwt.verify).mockReturnValue({ userId: 'user-1', sessionId: 'session-1' } as any)
      vi.mocked(prisma.session.findUnique).mockResolvedValue(mockSession as any)
      vi.mocked(prisma.session.delete).mockResolvedValue({} as any)
      vi.mocked(jwt.sign).mockReturnValue('new-token' as any)
      vi.mocked(prisma.session.create).mockResolvedValue({} as any)

      const result = await authService.refreshToken('valid-refresh-token')

      expect(result).toHaveProperty('accessToken')
      expect(result).toHaveProperty('refreshToken')
      expect(prisma.session.delete).toHaveBeenCalledWith({ where: { id: 'session-1' } })
    })

    it('should throw error for invalid refresh token', async () => {
      vi.mocked(jwt.verify).mockImplementation(() => {
        throw new Error('Invalid token')
      })

      await expect(authService.refreshToken('invalid-refresh-token')).rejects.toThrow()
    })
  })

  describe('logout', () => {
    it('should delete session by session ID from token', async () => {
      vi.mocked(jwt.verify).mockReturnValue({ sessionId: 'session-123' } as any)
      vi.mocked(prisma.session.delete).mockResolvedValue({} as any)

      await authService.logout('valid-token')

      expect(jwt.verify).toHaveBeenCalledWith('valid-token', expect.any(String))
      expect(prisma.session.delete).toHaveBeenCalledWith({ where: { id: 'session-123' } })
    })

    it('should not throw error for invalid token during logout', async () => {
      vi.mocked(jwt.verify).mockImplementation(() => {
        throw new Error('Invalid token')
      })

      // Should not throw
      await expect(authService.logout('invalid-token')).resolves.toBeUndefined()
    })

    it('should not throw error if session does not exist', async () => {
      vi.mocked(jwt.verify).mockReturnValue({ sessionId: 'session-123' } as any)
      vi.mocked(prisma.session.delete).mockRejectedValue(new Error('Session not found'))

      // Should not throw - graceful handling
      await expect(authService.logout('valid-token')).resolves.toBeUndefined()
    })
  })
})
