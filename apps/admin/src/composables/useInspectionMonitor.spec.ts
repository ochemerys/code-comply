import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from '../stores/auth'

vi.mock('@tanstack/vue-query', () => ({
  useQuery: vi.fn(() => ({ data: { value: null } })),
}))

import { useQuery } from '@tanstack/vue-query'
import { useInspectionMonitor, INSPECTION_MONITOR_REFETCH_MS } from './useInspectionMonitor'

describe('useInspectionMonitor', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    const auth = useAuthStore()
    auth.accessToken = 'tok'
    auth.refreshToken = 'ref'
    auth.user = {
      id: 'admin',
      email: 'admin@test.com',
      name: 'Admin',
      role: 'ADMIN',
      disciplines: [],
      certifications: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    vi.clearAllMocks()
  })

  it('configures auto-refresh every 30 seconds', () => {
    useInspectionMonitor()
    expect(INSPECTION_MONITOR_REFETCH_MS).toBe(30_000)

    expect(useQuery).toHaveBeenCalled()
    const args = (useQuery as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(args.refetchInterval).toBe(30_000)
    expect(args.enabled).toBeDefined()
  })
})
