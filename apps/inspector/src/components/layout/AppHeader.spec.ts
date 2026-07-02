import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import AppHeader from './AppHeader.vue'
import { useAuthStore } from '../../stores/auth'
import { useThemeStore } from '../../stores/theme'

// Mock sync engine to prevent IndexedDB errors
vi.mock('@/lib/db/sync-engine', () => ({
  syncEngine: {
    getStatusAsync: vi.fn(async () => ({
      isOnline: true,
      isSyncing: false,
      queueSize: 0,
      lastSyncedAt: null,
      lastError: null,
    })),
    getTotalQueueSize: vi.fn(async () => 0),
    sync: vi.fn(async () => undefined),
    retryFailedItems: vi.fn(async () => 0),
    clearFailedItems: vi.fn(async () => 0),
    on: vi.fn(),
    off: vi.fn(),
  },
}))

// Mock vue-router (spread real exports so router/index can load via permit-orphan-sync → api-error-handler)
vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return {
    ...actual,
    useRouter: () => ({
      push: vi.fn(),
    }),
  }
})

const mockTimestamps = {
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

describe('AppHeader', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('should hide app title on tablet landscape where SideNav shows the brand', () => {
    const wrapper = mount(AppHeader, {
      global: {
        stubs: {
          RouterLink: true,
        },
      },
    })

    const title = wrapper.find('h1')
    expect(title.exists()).toBe(true)
    expect(title.text()).toBe('CodeComply Field')
    expect(title.classes()).toContain('tablet-l:hidden')
    expect(title.find('[data-testid="app-brand-wordmark"]').exists()).toBe(true)
  })

  it('should display user initials when user is authenticated', () => {
    const authStore = useAuthStore()

    // Simulate authenticated user
    authStore.user = {
      id: '1',
      email: 'john.doe@example.com',
      name: 'John Doe',
      role: 'SCO',
      certifications: [],
      disciplines: [],
      ...mockTimestamps,
    }
    authStore.accessToken = 'mock-token'

    const wrapper = mount(AppHeader, {
      global: {
        stubs: {
          RouterLink: true,
        },
      },
    })

    // Check if user initials are displayed (first and last name)
    // Fixed: Updated to w-11 h-11 (44px touch target) and text-blue-600
    const userInitial = wrapper.find('.w-11.h-11.bg-bg-elevated.text-primary-600.rounded-full')
    expect(userInitial.exists()).toBe(true)
    expect(userInitial.text()).toBe('JD')
  })

  it('should display sync menu when user is authenticated', async () => {
    const authStore = useAuthStore()
    authStore.user = {
      id: '1',
      email: 'john.doe@example.com',
      name: 'John Doe',
      role: 'SCO',
      certifications: [],
      disciplines: [],
      ...mockTimestamps,
    }
    authStore.accessToken = 'mock-token'

    const wrapper = mount(AppHeader, {
      global: {
        stubs: {
          RouterLink: true,
        },
      },
    })

    expect(wrapper.find('[data-testid="header-sync-menu-button"]').exists()).toBe(true)

    await wrapper.find('[data-testid="header-sync-menu-button"]').trigger('click')
    expect(wrapper.find('[data-testid="header-sync-menu"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Sync now')
  })

  it('should not display user menu when user is not authenticated', () => {
    const wrapper = mount(AppHeader, {
      global: {
        stubs: {
          RouterLink: true,
        },
      },
    })

    // Check that user menu is not displayed
    // Fixed: Updated to w-11 h-11 (44px touch target) and text-blue-600
    const userMenu = wrapper.find('.w-11.h-11.bg-bg-elevated.text-primary-600.rounded-full')
    expect(userMenu.exists()).toBe(false)
  })

  it('should display user name in dropdown when menu is opened', async () => {
    const authStore = useAuthStore()

    // Simulate authenticated user
    authStore.user = {
      id: '1',
      email: 'jane.smith@example.com',
      name: 'Jane Smith',
      role: 'SCO',
      certifications: [],
      disciplines: [],
      ...mockTimestamps,
    }
    authStore.accessToken = 'mock-token'

    const wrapper = mount(AppHeader, {
      global: {
        stubs: {
          RouterLink: true,
        },
      },
    })

    // Click on user menu button
    // Fixed: Updated selector to match new w-11 h-11 classes
    const userMenuButton = wrapper.find('button:has(.w-11.h-11.bg-bg-elevated)')
    await userMenuButton.trigger('click')

    // Check if dropdown shows user name
    expect(wrapper.text()).toContain('Jane Smith')
    expect(wrapper.text()).toContain('jane.smith@example.com')
  })

  it('should toggle theme when theme button is clicked', async () => {
    const themeStore = useThemeStore()
    const initialDarkMode = themeStore.isDark

    const wrapper = mount(AppHeader, {
      global: {
        stubs: {
          RouterLink: true,
        },
      },
    })

    // Find and click theme toggle button
    const themeButton = wrapper.find('button[aria-label="Toggle dark mode"]')
    await themeButton.trigger('click')

    // Check if theme was toggled
    expect(themeStore.isDark).toBe(!initialDarkMode)
  })

  it('should display two characters for single name users', () => {
    const authStore = useAuthStore()

    // Simulate authenticated user with single name
    authStore.user = {
      id: '1',
      email: 'john@example.com',
      name: 'John',
      role: 'SCO',
      certifications: [],
      disciplines: [],
      ...mockTimestamps,
    }
    authStore.accessToken = 'mock-token'

    const wrapper = mount(AppHeader, {
      global: {
        stubs: {
          RouterLink: true,
        },
      },
    })

    // Check if first two characters are displayed for single name
    // Fixed: Updated to w-11 h-11 (44px touch target) and text-blue-600
    const userInitial = wrapper.find('.w-11.h-11.bg-bg-elevated.text-primary-600.rounded-full')
    expect(userInitial.exists()).toBe(true)
    expect(userInitial.text()).toBe('JO')
  })

  it('should handle names with multiple parts correctly', () => {
    const authStore = useAuthStore()

    // Simulate authenticated user with multiple name parts
    authStore.user = {
      id: '1',
      email: 'john@example.com',
      name: 'John Michael Smith',
      role: 'SCO',
      certifications: [],
      disciplines: [],
      ...mockTimestamps,
    }
    authStore.accessToken = 'mock-token'

    const wrapper = mount(AppHeader, {
      global: {
        stubs: {
          RouterLink: true,
        },
      },
    })

    // Check if first and last name initials are displayed
    // Fixed: Updated to w-11 h-11 (44px touch target) and text-blue-600
    const userInitial = wrapper.find('.w-11.h-11.bg-bg-elevated.text-primary-600.rounded-full')
    expect(userInitial.exists()).toBe(true)
    expect(userInitial.text()).toBe('JS')
  })
})
