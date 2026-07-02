import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import type { UserDTO } from '@codecomply/validators'
import { useRolePermissions } from './useRolePermissions'
import { useAuthStore } from '../stores/auth'

const now = new Date().toISOString()

describe('useRolePermissions (M11-S3)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('grants SCO workflow permissions to inspectors', () => {
    const authStore = useAuthStore()
    const user: UserDTO = {
      id: 'sco-1',
      email: 'sco@example.com',
      name: 'SCO',
      role: 'SCO',
      designationId: 'SCO-1',
      certifications: [],
      disciplines: [],
      createdAt: now,
      updatedAt: now,
    }
    authStore.setUser(user)

    const { can, isInspector, showAdminFeatures } = useRolePermissions()
    expect(isInspector.value).toBe(true)
    expect(can('submit_voc')).toBe(true)
    expect(can('view_own_inspections')).toBe(true)
    expect(showAdminFeatures.value).toBe(false)
  })

  it('does not grant admin permissions to non-SCO roles', () => {
    const authStore = useAuthStore()
    const user: UserDTO = {
      id: 'admin-1',
      email: 'admin@example.com',
      name: 'Admin',
      role: 'ADMIN',
      certifications: [],
      disciplines: [],
      createdAt: now,
      updatedAt: now,
    }
    authStore.setUser(user)

    const { can, isInspector } = useRolePermissions()
    expect(isInspector.value).toBe(false)
    expect(can('submit_voc')).toBe(false)
  })
})
