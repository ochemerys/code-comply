import { describe, it, expect, afterEach } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import DeficiencyIndicator from './DeficiencyIndicator.vue'

describe('DeficiencyIndicator', () => {
  let wrapper: VueWrapper

  afterEach(() => {
    wrapper?.unmount()
  })

  it('renders count and deficiency label for single item', () => {
    wrapper = mount(DeficiencyIndicator, { props: { count: 1 } })
    expect(wrapper.find('[data-testid="deficiency-indicator-count"]').text()).toBe('1')
    expect(wrapper.text()).toContain('deficiency')
    expect(wrapper.text()).not.toContain('deficiencies')
  })

  it('uses plural label for multiple deficiencies', () => {
    wrapper = mount(DeficiencyIndicator, { props: { count: 3 } })
    expect(wrapper.find('[data-testid="deficiency-indicator-count"]').text()).toBe('3')
    expect(wrapper.text()).toContain('deficiencies')
  })

  it('emits activate on click', async () => {
    wrapper = mount(DeficiencyIndicator, { props: { count: 2 } })
    await wrapper.find('[data-testid="deficiency-indicator"]').trigger('click')
    expect(wrapper.emitted('activate')).toHaveLength(1)
  })

  it('exposes an accessible label with count', () => {
    wrapper = mount(DeficiencyIndicator, { props: { count: 2 } })
    const btn = wrapper.find('[data-testid="deficiency-indicator"]').element as HTMLButtonElement
    expect(btn.getAttribute('aria-label')).toContain('2 linked deficiencies')
  })
})
