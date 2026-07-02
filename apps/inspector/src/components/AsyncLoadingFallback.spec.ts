import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AsyncLoadingFallback from './AsyncLoadingFallback.vue'

describe('AsyncLoadingFallback (M11-S8)', () => {
  it('renders loading label and test id', () => {
    const wrapper = mount(AsyncLoadingFallback, {
      props: { label: 'Loading page…', testId: 'route-loading-fallback' },
    })

    expect(wrapper.find('[data-testid="route-loading-fallback"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Loading page…')
    expect(wrapper.attributes('role')).toBe('status')
  })
})
