import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import AppShell from '../components/layout/AppShell.vue'
import HomeView from './HomeView.vue'
import { useAuthStore } from '../stores/auth'

// Mock vue-router (spread real exports so router/index can load via permit-orphan-sync → api-error-handler)
vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return {
    ...actual,
    useRoute: () => ({
      path: '/',
    }),
    useRouter: () => ({
      push: vi.fn(),
    }),
  }
})

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

const mockTimestamps = {
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

describe('HomeView - Bug M2-S12-B3: User initials not displayed in header', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('should display user initials in header after login', () => {
    const authStore = useAuthStore()

    // Simulate authenticated user (as would happen after login)
    authStore.user = {
      id: '1',
      email: 'inspector1@example.com',
      name: 'John Inspector',
      role: 'SCO',
      certifications: [],
      disciplines: [],
      ...mockTimestamps,
    }
    authStore.accessToken = 'mock-access-token'

    const wrapper = mount(
      {
        components: { AppShell, HomeView },
        template: '<AppShell><HomeView /></AppShell>',
      },
      {
        global: {
          stubs: {
            RouterLink: true,
          },
        },
      },
    )

    // Expected: User initials "JI" (first and last name) should be visible in the shell header
    const userInitial = wrapper.find('.w-11.h-11.bg-bg-elevated.text-primary-600.rounded-full')
    expect(userInitial.exists()).toBe(true)
    expect(userInitial.text()).toBe('JI')
  })

  it('should display user menu with profile and logout options', async () => {
    const authStore = useAuthStore()

    // Simulate authenticated user
    authStore.user = {
      id: '1',
      email: 'inspector1@example.com',
      name: 'John Inspector',
      role: 'SCO',
      certifications: [],
      disciplines: [],
      ...mockTimestamps,
    }
    authStore.accessToken = 'mock-access-token'

    const wrapper = mount(
      {
        components: { AppShell, HomeView },
        template: '<AppShell><HomeView /></AppShell>',
      },
      {
        global: {
          stubs: {
            RouterLink: true,
          },
        },
      },
    )

    // Try to find and click user menu button
    const userMenuButton = wrapper.find('button:has(.w-11.h-11.bg-bg-elevated)')

    expect(userMenuButton.exists()).toBe(true)

    if (userMenuButton.exists()) {
      await userMenuButton.trigger('click')

      // Should show user name and email in dropdown
      expect(wrapper.text()).toContain('John Inspector')
      expect(wrapper.text()).toContain('inspector1@example.com')
      expect(wrapper.text()).toContain('View Profile')
      expect(wrapper.text()).toContain('Sign Out')
    }
  })
})
