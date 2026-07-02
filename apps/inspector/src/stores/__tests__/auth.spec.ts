import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from '../auth'
import type { UserDTO, TokenDTO, LoginDTO } from '@codecomply/validators'

// Mock sync engine
vi.mock('../../lib/db/sync-engine', () => ({
  syncEngine: {
    resumeSync: vi.fn().mockResolvedValue(undefined),
    pauseSync: vi.fn(),
    setAuthCheck: vi.fn(),
  },
}))

describe('useAuthStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('should initialize with null user', () => {
    const authStore = useAuthStore()
    expect(authStore.user).toBeNull()
    expect(authStore.isAuthenticated).toBe(false)
    expect(authStore.accessToken).toBeNull()
    expect(authStore.refreshToken).toBeNull()
  })

  it('should set user and tokens after successful login', async () => {
    const authStore = useAuthStore()

    const credentials: LoginDTO = {
      email: 'test@example.com',
      password: 'password123',
    }

    const tokens: TokenDTO = {
      accessToken: 'test-access-token',
      refreshToken: 'test-refresh-token',
      expiresIn: 3600,
    }

    const userProfile: UserDTO = {
      id: '1',
      name: 'Test User',
      email: 'test@example.com',
      role: 'SCO',
      certifications: [],
      disciplines: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    await authStore.login(credentials, tokens, userProfile)

    expect(authStore.accessToken).toBe('test-access-token')
    expect(authStore.refreshToken).toBe('test-refresh-token')
    expect(authStore.user).toEqual(userProfile)
    expect(authStore.isAuthenticated).toBe(true)
    expect(authStore.lastLoginAt).toBeInstanceOf(Date)
    expect(authStore.offlineGracePeriodExpiry).toBeInstanceOf(Date)
  })

  it('should store tokens in localStorage on login', async () => {
    const authStore = useAuthStore()

    const credentials: LoginDTO = {
      email: 'test@example.com',
      password: 'password123',
    }

    const tokens: TokenDTO = {
      accessToken: 'test-access-token',
      refreshToken: 'test-refresh-token',
      expiresIn: 3600,
    }

    const userProfile: UserDTO = {
      id: '1',
      name: 'Test User',
      email: 'test@example.com',
      role: 'SCO',
      certifications: [],
      disciplines: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    await authStore.login(credentials, tokens, userProfile)

    expect(localStorage.getItem('accessToken')).toBe('test-access-token')
    expect(localStorage.getItem('refreshToken')).toBe('test-refresh-token')
  })

  it('should clear user and tokens on logout', async () => {
    const authStore = useAuthStore()

    // Set up authenticated state
    authStore.user = {
      id: '1',
      name: 'Test',
      email: 'test@example.com',
      role: 'SCO',
      certifications: [],
      disciplines: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    authStore.accessToken = 'token'
    authStore.refreshToken = 'refresh-token'
    localStorage.setItem('accessToken', 'token')
    localStorage.setItem('refreshToken', 'refresh-token')

    await authStore.logout()

    expect(authStore.user).toBeNull()
    expect(authStore.accessToken).toBeNull()
    expect(authStore.refreshToken).toBeNull()
    expect(authStore.isAuthenticated).toBe(false)
    expect(localStorage.getItem('accessToken')).toBeNull()
    expect(localStorage.getItem('refreshToken')).toBeNull()
  })

  it('should restore session from localStorage', () => {
    localStorage.setItem('accessToken', 'stored-token')
    localStorage.setItem('refreshToken', 'stored-refresh-token')

    const authStore = useAuthStore()
    authStore.restoreSession()

    expect(authStore.accessToken).toBe('stored-token')
    expect(authStore.refreshToken).toBe('stored-refresh-token')
  })

  it('should not restore session if tokens are missing', () => {
    const authStore = useAuthStore()
    authStore.restoreSession()

    expect(authStore.accessToken).toBeNull()
    expect(authStore.refreshToken).toBeNull()
  })

  it('should update tokens', async () => {
    const authStore = useAuthStore()

    const newTokens: TokenDTO = {
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
      expiresIn: 3600,
    }

    await authStore.updateTokens(newTokens)

    expect(authStore.accessToken).toBe('new-access-token')
    expect(authStore.refreshToken).toBe('new-refresh-token')
    expect(localStorage.getItem('accessToken')).toBe('new-access-token')
    expect(localStorage.getItem('refreshToken')).toBe('new-refresh-token')
  })

  it('should compute isOfflineGracePeriodActive correctly', async () => {
    const authStore = useAuthStore()

    // Initially false
    expect(authStore.isOfflineGracePeriodActive).toBe(false)

    // Set grace period in the future
    authStore.offlineGracePeriodExpiry = new Date(Date.now() + 1000 * 60 * 60) // 1 hour from now
    expect(authStore.isOfflineGracePeriodActive).toBe(true)

    // Set grace period in the past
    authStore.offlineGracePeriodExpiry = new Date(Date.now() - 1000) // 1 second ago
    expect(authStore.isOfflineGracePeriodActive).toBe(false)
  })

  it('should compute certifications from user', async () => {
    const authStore = useAuthStore()

    const userProfile: UserDTO = {
      id: '1',
      name: 'Test User',
      email: 'test@example.com',
      role: 'SCO',
      certifications: [
        { id: '1', name: 'Cert 1', designation: 'SCO-1', isValid: true },
        { id: '2', name: 'Cert 2', designation: 'SCO-2', isValid: false },
      ],
      disciplines: ['Electrical', 'Plumbing'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    authStore.setUser(userProfile)

    expect(authStore.certifications).toHaveLength(2)
    expect(authStore.certifications[0].name).toBe('Cert 1')
  })

  it('should compute disciplines from user', async () => {
    const authStore = useAuthStore()

    const userProfile: UserDTO = {
      id: '1',
      name: 'Test User',
      email: 'test@example.com',
      role: 'SCO',
      certifications: [],
      disciplines: ['Electrical', 'Plumbing'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    authStore.setUser(userProfile)

    expect(authStore.disciplines).toHaveLength(2)
    expect(authStore.disciplines).toContain('Electrical')
    expect(authStore.disciplines).toContain('Plumbing')
  })

  it('should return empty arrays for certifications and disciplines when user is null', () => {
    const authStore = useAuthStore()

    expect(authStore.certifications).toEqual([])
    expect(authStore.disciplines).toEqual([])
  })
})
