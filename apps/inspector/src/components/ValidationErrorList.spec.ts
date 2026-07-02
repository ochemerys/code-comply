import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ValidationErrorList from './ValidationErrorList.vue'

describe('ValidationErrorList', () => {
  it('does not render when there are no errors', () => {
    const wrapper = mount(ValidationErrorList, { props: { errors: [] } })
    expect(wrapper.find('[data-testid="validation-error-list"]').exists()).toBe(false)
  })

  it('renders a list of errors and a count', () => {
    const wrapper = mount(ValidationErrorList, {
      props: {
        errors: [
          { message: 'Outcome is required.' },
          { message: 'Signature is required.', hint: 'Sign and accept.', severity: 'warning' },
        ],
      },
    })

    expect(wrapper.find('[data-testid="validation-error-list"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="validation-error-list-count"]').text()).toBe('2')
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

  it('renders links for items with targetId', () => {
    const wrapper = mount(ValidationErrorList, {
      props: {
        errors: [{ message: 'Outcome is required.', targetId: 'inspection-review-outcome' }],
      },
      attachTo: document.body,
    })

    const link = wrapper.find('[data-testid="validation-error-link-0"]')
    expect(link.exists()).toBe(true)
    expect(link.attributes('href')).toBe('#inspection-review-outcome')
  })

  it('updates when errors prop changes (real-time updates)', async () => {
    const wrapper = mount(ValidationErrorList, {
      props: { errors: [{ message: 'A' }] },
    })

    expect(wrapper.find('[data-testid="validation-error-list-count"]').text()).toBe('1')
    await wrapper.setProps({ errors: [{ message: 'A' }, { message: 'B' }] })
    expect(wrapper.find('[data-testid="validation-error-list-count"]').text()).toBe('2')
    expect(wrapper.find('[data-testid="validation-error-item-1"]').text()).toContain('B')
  })
})
