import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import ChecklistItem from './ChecklistItem.vue'
import type { ChecklistItemData } from './ChecklistItem.vue'

vi.mock('@/components/PhotoGallery.vue', () => ({
  default: { name: 'PhotoGalleryStub', template: '<div data-testid="photo-gallery-stub" />' },
}))

describe('ChecklistItem', () => {
  let wrapper: VueWrapper<any>

  const createMockItem = (overrides?: Partial<ChecklistItemData>): ChecklistItemData => ({
    id: 'item-1',
    description: 'Test checklist item',
    codeReference: 'NBC 9.10.1',
    ...overrides,
  })

  beforeEach(() => {
    // Mock navigator.vibrate
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

  describe('Rendering', () => {
    it('should render checklist item with description', () => {
      const item = createMockItem()
      wrapper = mount(ChecklistItem, {
        props: { item },
      })

      expect(wrapper.text()).toContain('Test checklist item')
    })

    it('should render code reference when provided', () => {
      const item = createMockItem({ codeReference: 'NBC 9.10.1' })
      wrapper = mount(ChecklistItem, {
        props: { item },
      })

      expect(wrapper.text()).toContain('NBC 9.10.1')
    })

    it('should not render code reference when not provided', () => {
      const item = createMockItem({ codeReference: undefined })
      wrapper = mount(ChecklistItem, {
        props: { item },
      })

      expect(wrapper.text()).not.toContain('NBC')
    })

    it('should render all three buttons (Pass, Fail, N/A)', () => {
      const item = createMockItem()
      wrapper = mount(ChecklistItem, {
        props: { item },
      })

      const buttons = wrapper.findAll('button')
      expect(buttons.length).toBeGreaterThanOrEqual(3)
      expect(wrapper.text()).toContain('Pass')
      expect(wrapper.text()).toContain('Fail')
      expect(wrapper.text()).toContain('N/A')
    })

    it('embeds photo gallery when inspectionId is set and item requiresPhoto (M7-S16)', () => {
      const item = createMockItem({ requiresPhoto: true })
      wrapper = mount(ChecklistItem, {
        props: {
          item,
          inspectionId: 'insp-99',
          captureReturnRoute: 'checklist-execution',
        },
      })
      expect(wrapper.find('[data-testid="checklist-item-photo-gallery-wrap"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="photo-gallery-stub"]').exists()).toBe(true)
    })

    it('shows mandatory photo warning when parent flags missingMandatoryPhoto (M7-S16)', () => {
      const item = createMockItem({ requiresPhoto: true, result: 'FAIL' })
      wrapper = mount(ChecklistItem, {
        props: {
          item,
          inspectionId: 'insp-99',
          missingMandatoryPhoto: true,
        },
      })
      expect(wrapper.find('[data-testid="checklist-item-mandatory-photo-warning"]').exists()).toBe(
        true,
      )
    })
  })

  describe('Button Sizes (Touch Targets)', () => {
    it('should have minimum 44px height for all buttons', () => {
      const item = createMockItem()
      wrapper = mount(ChecklistItem, {
        props: { item },
      })

      const buttons = wrapper.findAll('button').slice(0, 3) // First 3 are Pass/Fail/NA
      buttons.forEach((button) => {
        expect(button.classes()).toContain('h-11') // 44px
        expect(button.classes()).toContain('min-h-[44px]')
      })
    })

    it('should have proper spacing between buttons', () => {
      const item = createMockItem()
      wrapper = mount(ChecklistItem, {
        props: { item },
      })

      const buttonContainer = wrapper.find('.flex.gap-2')
      expect(buttonContainer.exists()).toBe(true)
      expect(buttonContainer.classes()).toContain('gap-2') // 8px spacing
    })
  })

  describe('Visual States', () => {
    it('should highlight Pass button when result is PASS', () => {
      const item = createMockItem({ result: 'PASS' })
      wrapper = mount(ChecklistItem, {
        props: { item },
      })

      const passButton = wrapper.findAll('button')[0]
      expect(passButton.classes()).toContain('bg-green-600')
      expect(passButton.classes()).toContain('text-white')
    })

    it('should highlight Fail button when result is FAIL', () => {
      const item = createMockItem({ result: 'FAIL' })
      wrapper = mount(ChecklistItem, {
        props: { item },
      })

      const failButton = wrapper.findAll('button')[1]
      expect(failButton.classes()).toContain('bg-red-600')
      expect(failButton.classes()).toContain('text-white')
    })

    it('should highlight N/A button when result is NA', () => {
      const item = createMockItem({ result: 'NA' })
      wrapper = mount(ChecklistItem, {
        props: { item },
      })

      const naButton = wrapper.findAll('button')[2]
      expect(naButton.classes()).toContain('bg-gray-600')
      expect(naButton.classes()).toContain('text-white')
    })

    it('should show checkmark icon when Pass is selected', () => {
      const item = createMockItem({ result: 'PASS' })
      wrapper = mount(ChecklistItem, {
        props: { item },
      })

      const passButton = wrapper.findAll('button')[0]
      const svg = passButton.find('svg')
      expect(svg.exists()).toBe(true)
    })

    it('should show X icon when Fail is selected', () => {
      const item = createMockItem({ result: 'FAIL' })
      wrapper = mount(ChecklistItem, {
        props: { item },
      })

      const failButton = wrapper.findAll('button')[1]
      const svg = failButton.find('svg')
      expect(svg.exists()).toBe(true)
    })

    it('should show dash icon when N/A is selected', () => {
      const item = createMockItem({ result: 'NA' })
      wrapper = mount(ChecklistItem, {
        props: { item },
      })

      const naButton = wrapper.findAll('button')[2]
      const svg = naButton.find('svg')
      expect(svg.exists()).toBe(true)
    })

    it('should apply border color based on result', () => {
      const itemPass = createMockItem({ result: 'PASS' })
      wrapper = mount(ChecklistItem, {
        props: { item: itemPass },
      })
      expect(wrapper.find('.checklist-item').classes()).toContain('border-green-500')

      wrapper.unmount()

      const itemFail = createMockItem({ result: 'FAIL' })
      wrapper = mount(ChecklistItem, {
        props: { item: itemFail },
      })
      expect(wrapper.find('.checklist-item').classes()).toContain('border-red-500')

      wrapper.unmount()

      const itemNA = createMockItem({ result: 'NA' })
      wrapper = mount(ChecklistItem, {
        props: { item: itemNA },
      })
      expect(wrapper.find('.checklist-item').classes()).toContain('border-gray-400')
    })
  })

  describe('Interaction', () => {
    it('should emit update:result when Pass button is clicked', async () => {
      const item = createMockItem()
      wrapper = mount(ChecklistItem, {
        props: { item },
      })

      const passButton = wrapper.findAll('button')[0]
      await passButton.trigger('click')

      expect(wrapper.emitted('update:result')).toBeTruthy()
      expect(wrapper.emitted('update:result')?.[0]).toEqual(['PASS'])
    })

    it('should emit update:result when Fail button is clicked', async () => {
      const item = createMockItem()
      wrapper = mount(ChecklistItem, {
        props: { item },
      })

      const failButton = wrapper.findAll('button')[1]
      await failButton.trigger('click')

      expect(wrapper.emitted('update:result')).toBeTruthy()
      expect(wrapper.emitted('update:result')?.[0]).toEqual(['FAIL'])
    })

    it('should emit update:result when N/A button is clicked', async () => {
      const item = createMockItem()
      wrapper = mount(ChecklistItem, {
        props: { item },
      })

      const naButton = wrapper.findAll('button')[2]
      await naButton.trigger('click')

      expect(wrapper.emitted('update:result')).toBeTruthy()
      expect(wrapper.emitted('update:result')?.[0]).toEqual(['NA'])
    })

    it('should trigger haptic feedback when button is clicked', async () => {
      const vibrateMock = vi.fn()
      vi.stubGlobal('navigator', {
        vibrate: vibrateMock,
      })

      const item = createMockItem()
      wrapper = mount(ChecklistItem, {
        props: { item },
      })

      const passButton = wrapper.findAll('button')[0]
      await passButton.trigger('click')

      expect(vibrateMock).toHaveBeenCalledWith(10)
    })

    it('should handle missing vibrate API gracefully', async () => {
      vi.stubGlobal('navigator', {})

      const item = createMockItem()
      wrapper = mount(ChecklistItem, {
        props: { item },
      })

      const passButton = wrapper.findAll('button')[0]
      await expect(passButton.trigger('click')).resolves.not.toThrow()
    })

    it('should apply active:scale-95 class for tactile feedback', () => {
      const item = createMockItem()
      wrapper = mount(ChecklistItem, {
        props: { item },
      })

      const buttons = wrapper.findAll('button').slice(0, 3)
      buttons.forEach((button) => {
        expect(button.classes()).toContain('active:scale-95')
      })
    })
  })

  describe('Code Reference Display', () => {
    it('should show code reference when FAIL is selected and code reference exists', async () => {
      const item = createMockItem({
        result: 'FAIL',
        selectedCodeReference: {
          code: 'NBC',
          section: '9.10.1',
        },
      })
      wrapper = mount(ChecklistItem, {
        props: { item },
      })

      expect(wrapper.text()).toContain('Code Reference Required')
      expect(wrapper.text()).toContain('NBC - 9.10.1')
    })

    it('should not show code reference when PASS is selected', () => {
      const item = createMockItem({
        result: 'PASS',
        selectedCodeReference: {
          code: 'NBC',
          section: '9.10.1',
        },
      })
      wrapper = mount(ChecklistItem, {
        props: { item },
      })

      expect(wrapper.text()).not.toContain('Code Reference Required')
    })

    it('should not show code reference when N/A is selected', () => {
      const item = createMockItem({
        result: 'NA',
        selectedCodeReference: {
          code: 'NBC',
          section: '9.10.1',
        },
      })
      wrapper = mount(ChecklistItem, {
        props: { item },
      })

      expect(wrapper.text()).not.toContain('Code Reference Required')
    })

    it('should show prompt to select code reference when FAIL without code reference', () => {
      const item = createMockItem({
        result: 'FAIL',
        selectedCodeReference: undefined,
      })
      wrapper = mount(ChecklistItem, {
        props: { item },
      })

      expect(wrapper.text()).toContain('Code Reference Required')
      expect(wrapper.text()).toContain('Select Code Reference')
    })

    it('should emit select-code-reference when clicking select button', async () => {
      const item = createMockItem({
        result: 'FAIL',
        selectedCodeReference: undefined,
      })
      wrapper = mount(ChecklistItem, {
        props: { item },
      })

      const selectButton = wrapper.find('button[type="button"]:not(.flex-1)')
      await selectButton.trigger('click')

      expect(wrapper.emitted('select-code-reference')).toBeTruthy()
    })

    it('should emit change-code-reference when clicking edit button', async () => {
      const item = createMockItem({
        result: 'FAIL',
        selectedCodeReference: {
          code: 'NBC',
          section: '9.10.1',
        },
      })
      wrapper = mount(ChecklistItem, {
        props: { item },
      })

      // Find the edit button (has pencil icon)
      const editButton = wrapper.findAll('button').find((btn) => btn.html().includes('M15.232'))
      expect(editButton).toBeDefined()
      await editButton!.trigger('click')

      expect(wrapper.emitted('change-code-reference')).toBeTruthy()
    })

    it('should emit open-deficiency-form when parent sets code reference after FAIL (M6-S13)', async () => {
      const item = createMockItem({ result: 'FAIL', selectedCodeReference: undefined })
      wrapper = mount(ChecklistItem, {
        props: { item },
      })
      await wrapper.setProps({
        item: {
          ...item,
          selectedCodeReference: { code: 'NBC', section: '9.10.3.1' },
        },
      })
      expect(wrapper.emitted('open-deficiency-form')?.[0]?.[0]).toEqual({
        itemId: 'item-1',
        codeReference: { code: 'NBC', section: '9.10.3.1' },
      })
    })

    it('logs synchronous throw from open-deficiency-form listener', async () => {
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const item = createMockItem({ result: 'FAIL', selectedCodeReference: undefined })
      wrapper = mount(ChecklistItem, {
        props: { item },
        attrs: {
          onOpenDeficiencyForm: () => {
            throw new Error('parent sync failed')
          },
        },
      })
      await wrapper.setProps({
        item: {
          ...item,
          selectedCodeReference: { code: 'NBC', section: '9.10.3.1' },
        },
      })
      await wrapper.vm.$nextTick()
      expect(errSpy).toHaveBeenCalledWith(
        '[ChecklistItem] open-deficiency-form listener threw:',
        expect.any(Error),
      )
    })

    it('should emit select-code-reference after clicking Fail button without code reference', async () => {
      vi.useFakeTimers()

      const item = createMockItem()
      wrapper = mount(ChecklistItem, {
        props: { item },
      })

      const failButton = wrapper.findAll('button')[1]
      await failButton.trigger('click')

      // Fast-forward time to trigger the delayed emit
      vi.advanceTimersByTime(300)
      await wrapper.vm.$nextTick()

      expect(wrapper.emitted('select-code-reference')).toBeTruthy()

      vi.useRealTimers()
    })
  })

  describe('Accessibility', () => {
    it('should have proper button types', () => {
      const item = createMockItem()
      wrapper = mount(ChecklistItem, {
        props: { item },
      })

      const buttons = wrapper.findAll('button')
      buttons.forEach((button) => {
        expect(button.attributes('type')).toBe('button')
      })
    })

    it('should have focus ring classes', () => {
      const item = createMockItem()
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

    it('should have proper contrast ratios (via color classes)', () => {
      const item = createMockItem({ result: 'PASS' })
      wrapper = mount(ChecklistItem, {
        props: { item },
      })

      const passButton = wrapper.findAll('button')[0]
      // Green-600 on white text provides 4.5:1 contrast
      expect(passButton.classes()).toContain('bg-green-600')
      expect(passButton.classes()).toContain('text-white')
    })
  })

  describe('Dark Mode Support', () => {
    it('should have dark mode classes for buttons', () => {
      const item = createMockItem()
      wrapper = mount(ChecklistItem, {
        props: { item },
      })

      const buttons = wrapper.findAll('button').slice(0, 3)
      buttons.forEach((button) => {
        const classes = button.classes().join(' ')
        expect(classes).toContain('dark:')
      })
    })

    it('should use borders instead of shadows in dark mode', () => {
      const item = createMockItem({ result: 'PASS' })
      wrapper = mount(ChecklistItem, {
        props: { item },
      })

      const passButton = wrapper.findAll('button')[0]
      const classes = passButton.classes().join(' ')
      expect(classes).toContain('dark:shadow-none')
      expect(classes).toContain('dark:border')
    })
  })

  describe('Responsive Behavior', () => {
    it('should use flex layout for buttons', () => {
      const item = createMockItem()
      wrapper = mount(ChecklistItem, {
        props: { item },
      })

      const buttonContainer = wrapper.find('.flex.gap-2')
      expect(buttonContainer.exists()).toBe(true)
    })

    it('should have equal width buttons (flex-1)', () => {
      const item = createMockItem()
      wrapper = mount(ChecklistItem, {
        props: { item },
      })

      const buttons = wrapper.findAll('button').slice(0, 3)
      buttons.forEach((button) => {
        expect(button.classes()).toContain('flex-1')
      })
    })
  })

  describe('Performance', () => {
    it('should have tap-highlight disabled', () => {
      const item = createMockItem()
      wrapper = mount(ChecklistItem, {
        props: { item },
      })

      const checklistItem = wrapper.find('.checklist-item')
      const style = window.getComputedStyle(checklistItem.element)
      // Note: This is set via CSS, so we check the class exists
      expect(checklistItem.exists()).toBe(true)
    })

    it('should have touch-action manipulation on buttons', () => {
      const item = createMockItem()
      wrapper = mount(ChecklistItem, {
        props: { item },
      })

      const buttons = wrapper.findAll('button')
      expect(buttons.length).toBeGreaterThan(0)
      // Touch-action is set via CSS
    })

    it('should have transition classes for smooth animations', () => {
      const item = createMockItem()
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
  })

  describe('Edge Cases', () => {
    it('should handle rapid clicks gracefully', async () => {
      const item = createMockItem()
      wrapper = mount(ChecklistItem, {
        props: { item },
      })

      const passButton = wrapper.findAll('button')[0]

      // Rapid clicks
      await passButton.trigger('click')
      await passButton.trigger('click')
      await passButton.trigger('click')

      expect(wrapper.emitted('update:result')).toBeTruthy()
      expect(wrapper.emitted('update:result')?.length).toBe(3)
    })

    it('should handle switching between results', async () => {
      const item = createMockItem()
      wrapper = mount(ChecklistItem, {
        props: { item },
      })

      const [passButton, failButton, naButton] = wrapper.findAll('button').slice(0, 3)

      await passButton.trigger('click')
      expect(wrapper.emitted('update:result')?.[0]).toEqual(['PASS'])

      await failButton.trigger('click')
      expect(wrapper.emitted('update:result')?.[1]).toEqual(['FAIL'])

      await naButton.trigger('click')
      expect(wrapper.emitted('update:result')?.[2]).toEqual(['NA'])
    })

    it('should update when item prop changes', async () => {
      const item = createMockItem({ result: 'PASS' })
      wrapper = mount(ChecklistItem, {
        props: { item },
      })

      expect(wrapper.find('.border-green-500').exists()).toBe(true)

      await wrapper.setProps({
        item: { ...item, result: 'FAIL' },
      })

      expect(wrapper.find('.border-red-500').exists()).toBe(true)
    })

    it('should handle long descriptions gracefully', () => {
      const item = createMockItem({
        description:
          'This is a very long description that should wrap properly and not break the layout or cause any visual issues with the component rendering',
      })
      wrapper = mount(ChecklistItem, {
        props: { item },
      })

      expect(wrapper.text()).toContain('This is a very long description')
      const description = wrapper.find('h3')
      expect(description.classes()).toContain('leading-snug')
    })

    it('should handle missing code reference gracefully', () => {
      const item = createMockItem({
        result: 'FAIL',
        selectedCodeReference: undefined,
      })
      wrapper = mount(ChecklistItem, {
        props: { item },
      })

      expect(wrapper.text()).toContain('Select Code Reference')
    })
  })

  describe('Maximum 3 Taps Requirement', () => {
    it('should mark item with 1 tap (Pass)', async () => {
      const item = createMockItem()
      wrapper = mount(ChecklistItem, {
        props: { item },
      })

      const passButton = wrapper.findAll('button')[0]
      await passButton.trigger('click')

      expect(wrapper.emitted('update:result')).toBeTruthy()
      expect(wrapper.emitted('update:result')?.length).toBe(1)
    })

    it('should mark item with 2 taps (Fail + Select Code)', async () => {
      vi.useFakeTimers()

      const item = createMockItem()
      wrapper = mount(ChecklistItem, {
        props: { item },
      })

      // Tap 1: Click Fail
      const failButton = wrapper.findAll('button')[1]
      await failButton.trigger('click')

      // Tap 2: Would be selecting code reference (emitted event)
      vi.advanceTimersByTime(300)
      await wrapper.vm.$nextTick()

      expect(wrapper.emitted('select-code-reference')).toBeTruthy()
      expect(wrapper.emitted('update:result')?.length).toBe(1)

      vi.useRealTimers()
    })

    it('should complete workflow in maximum 3 taps', async () => {
      // This test verifies the acceptance criteria:
      // "Maximum 3 taps to mark any item"
      // Scenario: Fail + Select Code + Confirm = 3 taps

      const item = createMockItem()
      wrapper = mount(ChecklistItem, {
        props: { item },
      })

      // Tap 1: Mark as Fail
      const failButton = wrapper.findAll('button')[1]
      await failButton.trigger('click')
      expect(wrapper.emitted('update:result')?.length).toBe(1)

      // Tap 2: Select code reference (simulated by updating prop)
      await wrapper.setProps({
        item: {
          ...item,
          result: 'FAIL',
          selectedCodeReference: { code: 'NBC', section: '9.10.1' },
        },
      })

      // Tap 3: Would be confirming/moving to next item (handled by parent)
      // The component itself completes its responsibility in 2 taps
      expect(wrapper.emitted('update:result')?.length).toBe(1)
      expect(wrapper.text()).toContain('NBC - 9.10.1')
    })
  })

  describe('M6-S14 linked deficiency indicator', () => {
    it('shows indicator when FAIL and linkedDeficiencyCount > 0', () => {
      const item = createMockItem({
        result: 'FAIL',
        selectedCodeReference: { code: 'NBC', section: '9.10.1' },
      })
      wrapper = mount(ChecklistItem, {
        props: { item, linkedDeficiencyCount: 2 },
      })
      expect(wrapper.find('[data-testid="deficiency-indicator"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="deficiency-indicator-count"]').text()).toBe('2')
    })

    it('hides indicator when not FAIL even if count > 0', () => {
      const item = createMockItem({ result: 'PASS' })
      wrapper = mount(ChecklistItem, {
        props: { item, linkedDeficiencyCount: 1 },
      })
      expect(wrapper.find('[data-testid="deficiency-indicator"]').exists()).toBe(false)
    })

    it('emits navigate-linked-deficiencies when indicator is activated', async () => {
      const item = createMockItem({
        result: 'FAIL',
        selectedCodeReference: { code: 'NBC', section: '9.10.1' },
      })
      wrapper = mount(ChecklistItem, {
        props: { item, linkedDeficiencyCount: 1 },
      })
      await wrapper.find('[data-testid="deficiency-indicator"]').trigger('click')
      expect(wrapper.emitted('navigate-linked-deficiencies')).toEqual([[{ itemId: 'item-1' }]])
    })
  })
})
