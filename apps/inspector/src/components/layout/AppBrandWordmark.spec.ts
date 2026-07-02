import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AppBrandWordmark from './AppBrandWordmark.vue'

describe('AppBrandWordmark', () => {
  it('renders the full product name on one line', () => {
    const wrapper = mount(AppBrandWordmark)

    expect(wrapper.text()).toBe('CodeComply Field')
    expect(wrapper.find('[data-testid="app-brand-wordmark"]').classes()).toContain(
      'whitespace-nowrap',
    )
  })

  it('uses compact typography for the phone header size', () => {
    const wrapper = mount(AppBrandWordmark, {
      props: { size: 'sm' },
    })

    const wordmark = wrapper.find('[data-testid="app-brand-wordmark"]')
    expect(wordmark.classes()).toContain('text-base')
    expect(wordmark.classes()).toContain('font-bold')
    expect(wordmark.classes()).toContain('text-text-primary')
  })
})
