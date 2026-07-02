import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ValidationErrors from './ValidationErrors.vue'

describe('ValidationErrors', () => {
  it('does not render when there are no errors', () => {
    const wrapper = mount(ValidationErrors, { props: { errors: [] } })
    expect(wrapper.find('[data-testid="validation-errors"]').exists()).toBe(false)
  })

  it('renders a list of error messages', () => {
    const wrapper = mount(ValidationErrors, {
      props: {
        errors: [
          { message: 'Outcome is required.' },
          { message: 'Signature is required.', hint: 'Sign and accept.' },
        ],
      },
    })
    expect(wrapper.find('[data-testid="validation-errors"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="validation-error-item-0"]').text()).toContain(
      'Outcome is required.',
    )
    expect(wrapper.find('[data-testid="validation-error-item-1"]').text()).toContain(
      'Signature is required.',
    )
    expect(wrapper.find('[data-testid="validation-error-item-1"]').text()).toContain(
      'Sign and accept.',
    )
  })
})
