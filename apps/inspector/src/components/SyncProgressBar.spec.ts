/**
 * Unit tests for SyncProgressBar component
 *
 * @see M3-S5 - Create Sync Status Indicator Components
 * @see Testing Strategy §4.4 - Frontend Component Testing
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SyncProgressBar from './SyncProgressBar.vue'

describe('SyncProgressBar', () => {
  describe('rendering', () => {
    it('should render when status is syncing', () => {
      const wrapper = mount(SyncProgressBar, {
        props: {
          status: 'syncing',
        },
      })

      expect(wrapper.find('[role="progressbar"]').exists()).toBe(true)
    })

    it('should render when status is error', () => {
      const wrapper = mount(SyncProgressBar, {
        props: {
          status: 'error',
        },
      })

      expect(wrapper.find('[role="progressbar"]').exists()).toBe(true)
    })

    it('should not render when status is online', () => {
      const wrapper = mount(SyncProgressBar, {
        props: {
          status: 'online',
        },
      })

      expect(wrapper.find('[role="progressbar"]').exists()).toBe(false)
    })

    it('should not render when status is offline', () => {
      const wrapper = mount(SyncProgressBar, {
        props: {
          status: 'offline',
        },
      })

      expect(wrapper.find('[role="progressbar"]').exists()).toBe(false)
    })
  })

  describe('progress display', () => {
    it('should show indeterminate progress when progress is undefined', () => {
      const wrapper = mount(SyncProgressBar, {
        props: {
          status: 'syncing',
          progress: undefined,
        },
      })

      const progressBar = wrapper.find('.animate-progress-indeterminate')
      expect(progressBar.exists()).toBe(true)
    })

    it('should show determinate progress when progress is provided', () => {
      const wrapper = mount(SyncProgressBar, {
        props: {
          status: 'syncing',
          progress: 50,
        },
      })

      const progressBar = wrapper.find('[role="progressbar"] > div')
      expect(progressBar.attributes('style')).toContain('width: 50%')
    })

    it('should clamp progress to 0-100 range', () => {
      const testCases = [
        { progress: 0, expected: '0%' },
        { progress: 50, expected: '50%' },
        { progress: 100, expected: '100%' },
        { progress: 150, expected: '100%' },
      ]

      testCases.forEach(({ progress, expected }) => {
        const wrapper = mount(SyncProgressBar, {
          props: {
            status: 'syncing',
            progress,
          },
        })

        const progressBar = wrapper.find('[role="progressbar"] > div')
        expect(progressBar.attributes('style')).toContain(`width: ${expected}`)
      })
    })

    it('should show indeterminate progress for negative values', () => {
      const wrapper = mount(SyncProgressBar, {
        props: {
          status: 'syncing',
          progress: -10,
        },
      })

      const progressBar = wrapper.find('.animate-progress-indeterminate')
      expect(progressBar.exists()).toBe(true)
    })
  })

  describe('progress text', () => {
    it('should show progress text when showText is true', () => {
      const wrapper = mount(SyncProgressBar, {
        props: {
          status: 'syncing',
          progress: 50,
          showText: true,
        },
      })

      expect(wrapper.text()).toContain('Syncing 50%')
    })

    it('should not show progress text when showText is false', () => {
      const wrapper = mount(SyncProgressBar, {
        props: {
          status: 'syncing',
          progress: 50,
          showText: false,
        },
      })

      expect(wrapper.text()).not.toContain('Syncing 50%')
    })

    it('should show "Syncing..." for indeterminate progress', () => {
      const wrapper = mount(SyncProgressBar, {
        props: {
          status: 'syncing',
          progress: undefined,
          showText: true,
        },
      })

      expect(wrapper.text()).toContain('Syncing...')
    })

    it('should show "Sync failed" for error status', () => {
      const wrapper = mount(SyncProgressBar, {
        props: {
          status: 'error',
          showText: true,
        },
      })

      expect(wrapper.text()).toContain('Sync failed')
    })

    it('should show percentage when progress is provided', () => {
      const wrapper = mount(SyncProgressBar, {
        props: {
          status: 'syncing',
          progress: 75,
          showText: true,
        },
      })

      expect(wrapper.text()).toContain('75%')
    })
  })

  describe('color variants', () => {
    it('should apply blue color for syncing status', () => {
      const wrapper = mount(SyncProgressBar, {
        props: {
          status: 'syncing',
        },
      })

      const progressBar = wrapper.find('[role="progressbar"] > div')
      expect(progressBar.classes()).toContain('bg-blue-600')
    })

    it('should apply red color for error status', () => {
      const wrapper = mount(SyncProgressBar, {
        props: {
          status: 'error',
        },
      })

      const progressBar = wrapper.find('[role="progressbar"] > div')
      expect(progressBar.classes()).toContain('bg-red-600')
    })
  })

  describe('height variants', () => {
    it('should apply small height classes', () => {
      const wrapper = mount(SyncProgressBar, {
        props: {
          status: 'syncing',
          height: 'sm',
        },
      })

      const container = wrapper.find('[role="progressbar"]')
      expect(container.classes()).toContain('h-1')
    })

    it('should apply medium height classes (default)', () => {
      const wrapper = mount(SyncProgressBar, {
        props: {
          status: 'syncing',
          height: 'md',
        },
      })

      const container = wrapper.find('[role="progressbar"]')
      expect(container.classes()).toContain('h-2')
    })

    it('should apply large height classes', () => {
      const wrapper = mount(SyncProgressBar, {
        props: {
          status: 'syncing',
          height: 'lg',
        },
      })

      const container = wrapper.find('[role="progressbar"]')
      expect(container.classes()).toContain('h-3')
    })
  })

  describe('accessibility', () => {
    it('should have role="progressbar"', () => {
      const wrapper = mount(SyncProgressBar, {
        props: {
          status: 'syncing',
        },
      })

      const progressBar = wrapper.find('[role="progressbar"]')
      expect(progressBar.exists()).toBe(true)
    })

    it('should have aria-valuenow for determinate progress', () => {
      const wrapper = mount(SyncProgressBar, {
        props: {
          status: 'syncing',
          progress: 50,
        },
      })

      const progressBar = wrapper.find('[role="progressbar"]')
      expect(progressBar.attributes('aria-valuenow')).toBe('50')
    })

    it('should not have aria-valuenow for indeterminate progress', () => {
      const wrapper = mount(SyncProgressBar, {
        props: {
          status: 'syncing',
          progress: undefined,
        },
      })

      const progressBar = wrapper.find('[role="progressbar"]')
      expect(progressBar.attributes('aria-valuenow')).toBeUndefined()
    })

    it('should have aria-valuemin and aria-valuemax', () => {
      const wrapper = mount(SyncProgressBar, {
        props: {
          status: 'syncing',
          progress: 50,
        },
      })

      const progressBar = wrapper.find('[role="progressbar"]')
      expect(progressBar.attributes('aria-valuemin')).toBe('0')
      expect(progressBar.attributes('aria-valuemax')).toBe('100')
    })

    it('should have aria-label with progress text', () => {
      const wrapper = mount(SyncProgressBar, {
        props: {
          status: 'syncing',
          progress: 50,
        },
      })

      const progressBar = wrapper.find('[role="progressbar"]')
      expect(progressBar.attributes('aria-label')).toBe('Syncing 50%')
    })
  })

  describe('animations', () => {
    it('should have animation class for indeterminate progress', () => {
      const wrapper = mount(SyncProgressBar, {
        props: {
          status: 'syncing',
          progress: undefined,
        },
      })

      const progressBar = wrapper.find('[role="progressbar"] > div')
      expect(progressBar.classes()).toContain('animate-progress-indeterminate')
    })

    it('should have transition class for determinate progress', () => {
      const wrapper = mount(SyncProgressBar, {
        props: {
          status: 'syncing',
          progress: 50,
        },
      })

      const progressBar = wrapper.find('[role="progressbar"] > div')
      expect(progressBar.classes()).toContain('transition-all')
      expect(progressBar.classes()).toContain('duration-300')
      expect(progressBar.classes()).toContain('ease-out')
    })
  })

  describe('styling', () => {
    it('should have rounded corners on container', () => {
      const wrapper = mount(SyncProgressBar, {
        props: {
          status: 'syncing',
        },
      })

      const container = wrapper.find('[role="progressbar"]')
      expect(container.classes()).toContain('rounded-full')
    })

    it('should have rounded corners on progress bar', () => {
      const wrapper = mount(SyncProgressBar, {
        props: {
          status: 'syncing',
          progress: 50,
        },
      })

      const progressBar = wrapper.find('[role="progressbar"] > div')
      expect(progressBar.classes()).toContain('rounded-full')
    })

    it('should have overflow hidden on container', () => {
      const wrapper = mount(SyncProgressBar, {
        props: {
          status: 'syncing',
        },
      })

      const container = wrapper.find('[role="progressbar"]')
      expect(container.classes()).toContain('overflow-hidden')
    })
  })
})
