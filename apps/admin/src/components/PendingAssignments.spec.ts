import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PendingAssignments from './PendingAssignments.vue'

describe('PendingAssignments', () => {
  it('shows empty state', () => {
    const wrapper = mount(PendingAssignments, {
      props: { items: [], loading: false },
    })
    expect(wrapper.text()).toContain('No pending assignments')
  })
})
