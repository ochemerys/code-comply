import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PlaceholderAdminView from './PlaceholderAdminView.vue'

describe('PlaceholderAdminView', () => {
  it('shows the placeholder message for unimplemented sections', () => {
    const wrapper = mount(PlaceholderAdminView)

    expect(wrapper.text()).toContain('This section will be implemented in a later milestone story.')
  })
})
