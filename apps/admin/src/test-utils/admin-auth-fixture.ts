import type { UserDTO } from '@codecomply/validators'
import { useAuthStore } from '../stores/auth'

export function adminUserFixture(overrides: Partial<UserDTO> = {}): UserDTO {
  const now = new Date().toISOString()
  return {
    id: 'admin-test-1',
    email: 'admin@test.com',
    name: 'Test Admin',
    role: 'ADMIN',
    disciplines: [],
    certifications: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

/** Seed Pinia auth store as an authenticated admin (required for RBAC-gated sidebar nav). */
export function seedAdminAuthStore(overrides: Partial<UserDTO> = {}): void {
  const authStore = useAuthStore()
  authStore.setUser(adminUserFixture(overrides))
  authStore.updateTokens({
    accessToken: 'test-token',
    refreshToken: 'test-refresh',
    expiresIn: 3600,
  })
}
