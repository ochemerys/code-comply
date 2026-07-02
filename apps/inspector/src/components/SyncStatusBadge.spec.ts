/**
 * Unit tests for SyncStatusBadge component
 *
 * @see M3-S5 - Create Sync Status Indicator Components
 * @see Testing Strategy §4.4 - Frontend Component Testing
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SyncStatusBadge from './SyncStatusBadge.vue'

describe('SyncStatusBadge', () => {
  describe('rendering', () => {
    it('should render with default props', () => {
      const wrapper = mount(SyncStatusBadge, {
        props: {
          status: 'online',
        },
      })

      expect(wrapper.exists()).toBe(true)
      expect(wrapper.find('[role="status"]').exists()).toBe(true)
    })

    it('should display correct label for each status', () => {
      const statuses = [
        { status: 'online', label: 'Synced' },
        { status: 'offline', label: 'Offline' },
        { status: 'syncing', label: 'Syncing' },
        { status: 'error', label: 'Error' },
      ] as const

      statuses.forEach(({ status, label }) => {
        const wrapper = mount(SyncStatusBadge, {
          props: { status },
        })

        expect(wrapper.text()).toContain(label)
      })
    })

    it('should apply correct color classes for online status', () => {
      const wrapper = mount(SyncStatusBadge, {
        props: { status: 'online' },
      })

      const badge = wrapper.find('[role="status"]')
      expect(badge.classes()).toContain('bg-green-100')
      expect(badge.classes()).toContain('text-green-700')
    })

    it('should apply correct color classes for offline status', () => {
      const wrapper = mount(SyncStatusBadge, {
        props: { status: 'offline' },
      })

      const badge = wrapper.find('[role="status"]')
      expect(badge.classes()).toContain('bg-amber-100')
      expect(badge.classes()).toContain('text-amber-800')
    })

    it('should apply correct color classes for syncing status', () => {
      const wrapper = mount(SyncStatusBadge, {
        props: { status: 'syncing' },
      })

      const badge = wrapper.find('[role="status"]')
      expect(badge.classes()).toContain('bg-blue-100')
      expect(badge.classes()).toContain('text-blue-700')
    })

    it('should apply correct color classes for error status', () => {
      const wrapper = mount(SyncStatusBadge, {
        props: { status: 'error' },
      })

      const badge = wrapper.find('[role="status"]')
      expect(badge.classes()).toContain('bg-red-100')
      expect(badge.classes()).toContain('text-red-700')
    })
  })

  describe('icon display', () => {
    it('should show check-circle icon for online status', () => {
      const wrapper = mount(SyncStatusBadge, {
        props: { status: 'online' },
      })

      const svg = wrapper.find('svg')
      expect(svg.exists()).toBe(true)
      // Check for check-circle path
      expect(svg.html()).toContain('M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z')
    })

    it('should show wifi-off icon for offline status', () => {
      const wrapper = mount(SyncStatusBadge, {
        props: { status: 'offline' },
      })

      const svg = wrapper.find('svg')
      expect(svg.exists()).toBe(true)
      // Check for wifi-off path (partial match)
      expect(svg.html()).toContain('M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829')
    })

    it('should show refresh-cw icon for syncing status', () => {
      const wrapper = mount(SyncStatusBadge, {
        props: { status: 'syncing' },
      })

      const svg = wrapper.find('svg')
      expect(svg.exists()).toBe(true)
      // Check for refresh-cw path
      expect(svg.html()).toContain(
        'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581',
      )
    })

    it('should show alert-circle icon for error status', () => {
      const wrapper = mount(SyncStatusBadge, {
        props: { status: 'error' },
      })

      const svg = wrapper.find('svg')
      expect(svg.exists()).toBe(true)
      // Check for alert-circle path
      expect(svg.html()).toContain('M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z')
    })

    it('should animate icon when syncing', () => {
      const wrapper = mount(SyncStatusBadge, {
        props: { status: 'syncing' },
      })

      const svg = wrapper.find('svg')
      expect(svg.classes()).toContain('animate-spin')
    })

    it('should not animate icon when not syncing', () => {
      const wrapper = mount(SyncStatusBadge, {
        props: { status: 'online' },
      })

      const svg = wrapper.find('svg')
      expect(svg.classes()).not.toContain('animate-spin')
    })
  })

  describe('pending count badge', () => {
    it('should show pending count when showCount is true and count > 0', () => {
      const wrapper = mount(SyncStatusBadge, {
        props: {
          status: 'online',
          pendingCount: 5,
          showCount: true,
        },
      })

      const countBadge = wrapper.findAll('[role="status"]')[1]
      expect(countBadge.exists()).toBe(true)
      expect(countBadge.text()).toBe('5')
    })

    it('should not show pending count when showCount is false', () => {
      const wrapper = mount(SyncStatusBadge, {
        props: {
          status: 'online',
          pendingCount: 5,
          showCount: false,
        },
      })

      const badges = wrapper.findAll('[role="status"]')
      expect(badges.length).toBe(1) // Only main badge
    })

    it('should not show pending count when count is 0', () => {
      const wrapper = mount(SyncStatusBadge, {
        props: {
          status: 'online',
          pendingCount: 0,
          showCount: true,
        },
      })

      const badges = wrapper.findAll('[role="status"]')
      expect(badges.length).toBe(1) // Only main badge
    })

    it('should show "99+" when count exceeds 99', () => {
      const wrapper = mount(SyncStatusBadge, {
        props: {
          status: 'online',
          pendingCount: 150,
          showCount: true,
        },
      })

      const countBadge = wrapper.findAll('[role="status"]')[1]
      expect(countBadge.text()).toBe('99+')
    })

    it('should have correct aria-label for pending count', () => {
      const wrapper = mount(SyncStatusBadge, {
        props: {
          status: 'online',
          pendingCount: 5,
          showCount: true,
        },
      })

      const countBadge = wrapper.findAll('[role="status"]')[1]
      expect(countBadge.attributes('aria-label')).toBe('5 items pending sync')
    })
  })

  describe('size variants', () => {
    it('should apply small size classes', () => {
      const wrapper = mount(SyncStatusBadge, {
        props: {
          status: 'online',
          size: 'sm',
        },
      })

      const badge = wrapper.find('[role="status"]')
      expect(badge.classes()).toContain('px-2')
      expect(badge.classes()).toContain('py-1')
      expect(badge.classes()).toContain('text-xs')

      const svg = wrapper.find('svg')
      expect(svg.classes()).toContain('w-3')
      expect(svg.classes()).toContain('h-3')
    })

    it('should apply medium size classes (default)', () => {
      const wrapper = mount(SyncStatusBadge, {
        props: {
          status: 'online',
          size: 'md',
        },
      })

      const badge = wrapper.find('[role="status"]')
      expect(badge.classes()).toContain('px-3')
      expect(badge.classes()).toContain('py-1.5')
      expect(badge.classes()).toContain('text-sm')

      const svg = wrapper.find('svg')
      expect(svg.classes()).toContain('w-4')
      expect(svg.classes()).toContain('h-4')
    })

    it('should apply large size classes', () => {
      const wrapper = mount(SyncStatusBadge, {
        props: {
          status: 'online',
          size: 'lg',
        },
      })

      const badge = wrapper.find('[role="status"]')
      expect(badge.classes()).toContain('px-4')
      expect(badge.classes()).toContain('py-2')
      expect(badge.classes()).toContain('text-base')

      const svg = wrapper.find('svg')
      expect(svg.classes()).toContain('w-5')
      expect(svg.classes()).toContain('h-5')
    })
  })

  describe('accessibility', () => {
    it('should have role="status" on badge', () => {
      const wrapper = mount(SyncStatusBadge, {
        props: { status: 'online' },
      })

      const badge = wrapper.find('[role="status"]')
      expect(badge.exists()).toBe(true)
    })

    it('should have correct aria-label for status', () => {
      const wrapper = mount(SyncStatusBadge, {
        props: { status: 'online' },
      })

      const badge = wrapper.find('[role="status"]')
      expect(badge.attributes('aria-label')).toBe('Sync status: Synced')
    })

    it('should have aria-hidden on icon', () => {
      const wrapper = mount(SyncStatusBadge, {
        props: { status: 'online' },
      })

      const svg = wrapper.find('svg')
      expect(svg.attributes('aria-hidden')).toBe('true')
    })
  })

  describe('responsive behavior', () => {
    it('should hide label on small screens', () => {
      const wrapper = mount(SyncStatusBadge, {
        props: { status: 'online' },
      })

      const label = wrapper.find('span')
      expect(label.classes()).toContain('hidden')
      expect(label.classes()).toContain('tablet:inline')
    })
  })

  describe('transitions', () => {
    it('should have transition classes', () => {
      const wrapper = mount(SyncStatusBadge, {
        props: { status: 'online' },
      })

      const badge = wrapper.find('[role="status"]')
      expect(badge.classes()).toContain('transition-all')
      expect(badge.classes()).toContain('duration-200')
      expect(badge.classes()).toContain('ease-out')
    })
  })
})
