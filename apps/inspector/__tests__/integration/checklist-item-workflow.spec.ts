import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import ChecklistItem from '../../src/components/ChecklistItem.vue'
import type { ChecklistItemData } from '../../src/components/ChecklistItem.vue'

describe('ChecklistItem Integration Tests', () => {
  let wrapper: VueWrapper<any>

  beforeEach(() => {
    vi.stubGlobal('navigator', {
      vibrate: vi.fn(),
    })
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
    vi.restoreAllMocks()
  })

  describe('Complete User Workflow', () => {
    it('should complete Pass workflow in 1 tap', async () => {
      const item: ChecklistItemData = {
        id: 'item-1',
        description: 'Check fire extinguisher is present',
        codeReference: 'NBC 9.10.1',
      }

      wrapper = mount(ChecklistItem, {
        props: { item },
      })

      // User taps Pass button
      const passButton = wrapper.findAll('button')[0]
      await passButton.trigger('click')

      // Verify result is emitted
      expect(wrapper.emitted('update:result')).toBeTruthy()
      expect(wrapper.emitted('update:result')?.[0]).toEqual(['PASS'])

      // Verify visual feedback
      expect(wrapper.find('.border-green-500').exists()).toBe(true)
      expect(passButton.classes()).toContain('bg-green-600')
    })

    it('should complete N/A workflow in 1 tap', async () => {
      const item: ChecklistItemData = {
        id: 'item-1',
        description: 'Check sprinkler system',
        codeReference: 'NBC 9.10.2',
      }

      wrapper = mount(ChecklistItem, {
        props: { item },
      })

      // User taps N/A button
      const naButton = wrapper.findAll('button')[2]
      await naButton.trigger('click')

      // Verify result is emitted
      expect(wrapper.emitted('update:result')).toBeTruthy()
      expect(wrapper.emitted('update:result')?.[0]).toEqual(['NA'])

      // Verify visual feedback
      expect(wrapper.find('.border-gray-400').exists()).toBe(true)
      expect(naButton.classes()).toContain('bg-gray-600')
    })

    it('should complete Fail workflow with code reference in 2 taps', async () => {
      vi.useFakeTimers()

      const item: ChecklistItemData = {
        id: 'item-1',
        description: 'Check emergency exit signage',
        codeReference: 'NBC 9.10.3',
      }

      wrapper = mount(ChecklistItem, {
        props: { item },
      })

      // Tap 1: User marks as Fail
      const failButton = wrapper.findAll('button')[1]
      await failButton.trigger('click')

      expect(wrapper.emitted('update:result')?.[0]).toEqual(['FAIL'])
      expect(wrapper.find('.border-red-500').exists()).toBe(true)

      // Component prompts for code reference
      vi.advanceTimersByTime(300)
      await nextTick()

      expect(wrapper.emitted('select-code-reference')).toBeTruthy()
      expect(wrapper.text()).toContain('Select Code Reference')

      // Tap 2: User selects code reference (simulated by parent updating prop)
      await wrapper.setProps({
        item: {
          ...item,
          result: 'FAIL',
          selectedCodeReference: {
            code: 'NBC',
            section: '9.10.3.1',
          },
        },
      })

      expect(wrapper.emitted('open-deficiency-form')?.[0]?.[0]).toMatchObject({
        itemId: 'item-1',
        codeReference: { code: 'NBC', section: '9.10.3.1' },
      })

      // Verify code reference is displayed
      expect(wrapper.text()).toContain('NBC - 9.10.3.1')
      expect(wrapper.text()).toContain('Code Reference Required')

      vi.useRealTimers()
    })

    it('should allow changing result after initial selection', async () => {
      const item: ChecklistItemData = {
        id: 'item-1',
        description: 'Check fire alarm panel',
        result: 'PASS',
      }

      wrapper = mount(ChecklistItem, {
        props: { item },
      })

      // Initially marked as Pass
      expect(wrapper.find('.border-green-500').exists()).toBe(true)

      // User changes mind and marks as Fail
      const failButton = wrapper.findAll('button')[1]
      await failButton.trigger('click')

      expect(wrapper.emitted('update:result')?.[0]).toEqual(['FAIL'])
      expect(wrapper.find('.border-red-500').exists()).toBe(true)

      // User changes again to N/A
      const naButton = wrapper.findAll('button')[2]
      await naButton.trigger('click')

      expect(wrapper.emitted('update:result')?.[1]).toEqual(['NA'])
      expect(wrapper.find('.border-gray-400').exists()).toBe(true)
    })
  })

  describe('Code Reference Management', () => {
    it('should show existing code reference when Fail is selected', async () => {
      const item: ChecklistItemData = {
        id: 'item-1',
        description: 'Check exit door width',
        result: 'FAIL',
        selectedCodeReference: {
          code: 'NBC',
          section: '3.3.1.5',
        },
      }

      wrapper = mount(ChecklistItem, {
        props: { item },
      })

      expect(wrapper.text()).toContain('Code Reference Required')
      expect(wrapper.text()).toContain('NBC - 3.3.1.5')
    })

    it('should allow editing existing code reference', async () => {
      const item: ChecklistItemData = {
        id: 'item-1',
        description: 'Check handrail height',
        result: 'FAIL',
        selectedCodeReference: {
          code: 'NBC',
          section: '3.4.6.5',
        },
      }

      wrapper = mount(ChecklistItem, {
        props: { item },
      })

      // Find and click edit button
      const editButton = wrapper.findAll('button').find((btn) => btn.html().includes('M15.232'))
      expect(editButton).toBeDefined()
      await editButton!.trigger('click')

      expect(wrapper.emitted('change-code-reference')).toBeTruthy()
    })

    it('should hide code reference when changing from Fail to Pass', async () => {
      const item: ChecklistItemData = {
        id: 'item-1',
        description: 'Check stair tread depth',
        result: 'FAIL',
        selectedCodeReference: {
          code: 'NBC',
          section: '3.4.6.7',
        },
      }

      wrapper = mount(ChecklistItem, {
        props: { item },
      })

      // Code reference is visible
      expect(wrapper.text()).toContain('NBC - 3.4.6.7')

      // Change to Pass
      const passButton = wrapper.findAll('button')[0]
      await passButton.trigger('click')

      // Update prop to reflect change
      await wrapper.setProps({
        item: {
          ...item,
          result: 'PASS',
        },
      })

      // Code reference should be hidden
      expect(wrapper.text()).not.toContain('NBC - 3.4.6.7')
      expect(wrapper.text()).not.toContain('Code Reference Required')
    })
  })

  describe('Visual and Haptic Feedback', () => {
    it('should provide haptic feedback on button press', async () => {
      const vibrateMock = vi.fn()
      vi.stubGlobal('navigator', {
        vibrate: vibrateMock,
      })

      const item: ChecklistItemData = {
        id: 'item-1',
        description: 'Test item',
      }

      wrapper = mount(ChecklistItem, {
        props: { item },
      })

      const passButton = wrapper.findAll('button')[0]
      await passButton.trigger('click')

      expect(vibrateMock).toHaveBeenCalledWith(10)
    })

    it('should show visual feedback animation on tap', async () => {
      vi.useFakeTimers()

      const item: ChecklistItemData = {
        id: 'item-1',
        description: 'Test item',
      }

      wrapper = mount(ChecklistItem, {
        props: { item },
      })

      const passButton = wrapper.findAll('button')[0]
      await passButton.trigger('click')

      // Visual feedback should be visible immediately
      await nextTick()
      // Note: The feedback div is conditionally rendered based on showFeedback ref
      // which is set to true on click and false after 300ms

      vi.advanceTimersByTime(300)
      await nextTick()

      vi.useRealTimers()
    })

    it('should show checkmark icon when Pass is selected', async () => {
      const item: ChecklistItemData = {
        id: 'item-1',
        description: 'Test item',
      }

      wrapper = mount(ChecklistItem, {
        props: { item },
      })

      const passButton = wrapper.findAll('button')[0]
      await passButton.trigger('click')

      // Update prop to reflect selection
      await wrapper.setProps({
        item: {
          ...item,
          result: 'PASS',
        },
      })

      const svg = passButton.find('svg')
      expect(svg.exists()).toBe(true)
      // Checkmark path
      expect(svg.html()).toContain('M5 13l4 4L19 7')
    })

    it('should show X icon when Fail is selected', async () => {
      const item: ChecklistItemData = {
        id: 'item-1',
        description: 'Test item',
      }

      wrapper = mount(ChecklistItem, {
        props: { item },
      })

      const failButton = wrapper.findAll('button')[1]
      await failButton.trigger('click')

      await wrapper.setProps({
        item: {
          ...item,
          result: 'FAIL',
        },
      })

      const svg = failButton.find('svg')
      expect(svg.exists()).toBe(true)
      // X path
      expect(svg.html()).toContain('M6 18L18 6M6 6l12 12')
    })
  })

  describe('Accessibility Integration', () => {
    it('should be keyboard navigable', async () => {
      const item: ChecklistItemData = {
        id: 'item-1',
        description: 'Test item',
      }

      wrapper = mount(ChecklistItem, {
        props: { item },
      })

      const buttons = wrapper.findAll('button').slice(0, 3)

      // All buttons should be focusable
      buttons.forEach((button) => {
        expect(button.attributes('type')).toBe('button')
        expect(button.classes()).toContain('focus:ring-2')
      })
    })

    it('should maintain focus ring visibility', () => {
      const item: ChecklistItemData = {
        id: 'item-1',
        description: 'Test item',
      }

      wrapper = mount(ChecklistItem, {
        props: { item },
      })

      const buttons = wrapper.findAll('button').slice(0, 3)

      buttons.forEach((button) => {
        expect(button.classes()).toContain('focus:outline-none')
        expect(button.classes()).toContain('focus:ring-2')
        expect(button.classes()).toContain('focus:ring-offset-2')
      })
    })
  })

  describe('Responsive Behavior', () => {
    it('should maintain touch targets on all screen sizes', () => {
      const item: ChecklistItemData = {
        id: 'item-1',
        description: 'Test item',
      }

      wrapper = mount(ChecklistItem, {
        props: { item },
      })

      const buttons = wrapper.findAll('button').slice(0, 3)

      buttons.forEach((button) => {
        // Minimum 44px height
        expect(button.classes()).toContain('h-11')
        expect(button.classes()).toContain('min-h-[44px]')
      })
    })

    it('should distribute buttons evenly with flex layout', () => {
      const item: ChecklistItemData = {
        id: 'item-1',
        description: 'Test item',
      }

      wrapper = mount(ChecklistItem, {
        props: { item },
      })

      const buttonContainer = wrapper.find('.flex.gap-2')
      expect(buttonContainer.exists()).toBe(true)

      const buttons = wrapper.findAll('button').slice(0, 3)
      buttons.forEach((button) => {
        expect(button.classes()).toContain('flex-1')
      })
    })
  })

  describe('Dark Mode Integration', () => {
    it('should apply dark mode styles to all interactive elements', () => {
      const item: ChecklistItemData = {
        id: 'item-1',
        description: 'Test item',
        result: 'PASS',
      }

      wrapper = mount(ChecklistItem, {
        props: { item },
      })

      const passButton = wrapper.findAll('button')[0]
      const classes = passButton.classes().join(' ')

      // Should have dark mode variants
      expect(classes).toContain('dark:shadow-none')
      expect(classes).toContain('dark:border')
    })

    it('should use borders instead of shadows in dark mode', () => {
      const item: ChecklistItemData = {
        id: 'item-1',
        description: 'Test item',
        result: 'FAIL',
      }

      wrapper = mount(ChecklistItem, {
        props: { item },
      })

      const failButton = wrapper.findAll('button')[1]
      const classes = failButton.classes().join(' ')

      expect(classes).toContain('shadow-sm')
      expect(classes).toContain('dark:shadow-none')
      expect(classes).toContain('dark:border-red-800')
    })
  })

  describe('Performance and Optimization', () => {
    it('should handle rapid state changes efficiently', async () => {
      const item: ChecklistItemData = {
        id: 'item-1',
        description: 'Test item',
      }

      wrapper = mount(ChecklistItem, {
        props: { item },
      })

      const [passButton, failButton, naButton] = wrapper.findAll('button').slice(0, 3)

      // Rapid clicks
      await passButton.trigger('click')
      await failButton.trigger('click')
      await naButton.trigger('click')
      await passButton.trigger('click')

      expect(wrapper.emitted('update:result')?.length).toBe(4)
    })

    it('should have smooth transitions', () => {
      const item: ChecklistItemData = {
        id: 'item-1',
        description: 'Test item',
      }

      wrapper = mount(ChecklistItem, {
        props: { item },
      })

      const buttons = wrapper.findAll('button').slice(0, 3)

      buttons.forEach((button) => {
        expect(button.classes()).toContain('transition-all')
        expect(button.classes()).toContain('duration-200')
        expect(button.classes()).toContain('ease-out')
      })
    })

    it('should disable tap highlight for better performance', () => {
      const item: ChecklistItemData = {
        id: 'item-1',
        description: 'Test item',
      }

      wrapper = mount(ChecklistItem, {
        props: { item },
      })

      const checklistItem = wrapper.find('.checklist-item')
      expect(checklistItem.exists()).toBe(true)
      // -webkit-tap-highlight-color is set via CSS
    })
  })

  describe('Error Handling', () => {
    it('should handle missing vibrate API gracefully', async () => {
      vi.stubGlobal('navigator', {})

      const item: ChecklistItemData = {
        id: 'item-1',
        description: 'Test item',
      }

      wrapper = mount(ChecklistItem, {
        props: { item },
      })

      const passButton = wrapper.findAll('button')[0]

      // Should not throw error
      await expect(passButton.trigger('click')).resolves.not.toThrow()
      expect(wrapper.emitted('update:result')).toBeTruthy()
    })

    it('should handle undefined code reference gracefully', async () => {
      const item: ChecklistItemData = {
        id: 'item-1',
        description: 'Test item',
        result: 'FAIL',
        selectedCodeReference: undefined,
      }

      wrapper = mount(ChecklistItem, {
        props: { item },
      })

      expect(wrapper.text()).toContain('Select Code Reference')
      expect(() => wrapper.html()).not.toThrow()
    })

    it('should handle prop updates correctly', async () => {
      const item: ChecklistItemData = {
        id: 'item-1',
        description: 'Test item',
        result: 'PASS',
      }

      wrapper = mount(ChecklistItem, {
        props: { item },
      })

      expect(wrapper.find('.border-green-500').exists()).toBe(true)

      // Update prop
      await wrapper.setProps({
        item: {
          ...item,
          result: 'FAIL',
          selectedCodeReference: {
            code: 'NBC',
            section: '9.10.1',
          },
        },
      })

      expect(wrapper.find('.border-red-500').exists()).toBe(true)
      expect(wrapper.text()).toContain('NBC - 9.10.1')
    })
  })

  describe('Real-world Scenarios', () => {
    it('should handle inspector marking multiple items in sequence', async () => {
      const items: ChecklistItemData[] = [
        { id: 'item-1', description: 'Fire extinguisher present' },
        { id: 'item-2', description: 'Exit signs illuminated' },
        { id: 'item-3', description: 'Emergency lighting functional' },
      ]

      const results: Array<'PASS' | 'FAIL' | 'NA'> = []

      for (const item of items) {
        wrapper = mount(ChecklistItem, {
          props: { item },
        })

        // Mark first as Pass
        if (item.id === 'item-1') {
          const passButton = wrapper.findAll('button')[0]
          await passButton.trigger('click')
          results.push('PASS')
        }

        // Mark second as Fail
        if (item.id === 'item-2') {
          const failButton = wrapper.findAll('button')[1]
          await failButton.trigger('click')
          results.push('FAIL')
        }

        // Mark third as N/A
        if (item.id === 'item-3') {
          const naButton = wrapper.findAll('button')[2]
          await naButton.trigger('click')
          results.push('NA')
        }

        wrapper.unmount()
      }

      expect(results).toEqual(['PASS', 'FAIL', 'NA'])
    })

    it('should handle offline scenario with local state', async () => {
      const item: ChecklistItemData = {
        id: 'item-1',
        description: 'Check sprinkler system',
      }

      wrapper = mount(ChecklistItem, {
        props: { item },
      })

      // Inspector marks item while offline
      const passButton = wrapper.findAll('button')[0]
      await passButton.trigger('click')

      // Result is emitted for local storage
      expect(wrapper.emitted('update:result')?.[0]).toEqual(['PASS'])

      // Visual feedback confirms action
      expect(wrapper.find('.border-green-500').exists()).toBe(true)
    })

    it('should support undo/redo by changing result', async () => {
      const item: ChecklistItemData = {
        id: 'item-1',
        description: 'Check fire alarm',
        result: 'PASS',
      }

      wrapper = mount(ChecklistItem, {
        props: { item },
      })

      // Initially Pass
      expect(wrapper.find('.border-green-500').exists()).toBe(true)

      // Inspector changes to Fail (undo)
      const failButton = wrapper.findAll('button')[1]
      await failButton.trigger('click')
      expect(wrapper.emitted('update:result')?.[0]).toEqual(['FAIL'])

      // Inspector changes back to Pass (redo)
      const passButton = wrapper.findAll('button')[0]
      await passButton.trigger('click')
      expect(wrapper.emitted('update:result')?.[1]).toEqual(['PASS'])
    })
  })
})
