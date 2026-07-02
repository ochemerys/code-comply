import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import UnsafeToggle from './UnsafeToggle.vue'

describe('UnsafeToggle (M6-S16)', () => {
  it('renders label and helper text', () => {
    const wrapper = mount(UnsafeToggle, { props: { modelValue: false } })
    expect(wrapper.text()).toMatch(/Unsafe Condition/i)
    expect(wrapper.text()).toMatch(/immediate safety risk/i)
    expect(wrapper.find('[data-testid="unsafe-condition-toggle"]').exists()).toBe(true)
  })

  it('toggles model when the checkbox is used', async () => {
    const wrapper = mount(UnsafeToggle, { props: { modelValue: false } })
    const input = wrapper.find('[data-testid="deficiency-flag-unsafe"]').element as HTMLInputElement
    expect(input.checked).toBe(false)
    await wrapper.find('[data-testid="deficiency-flag-unsafe"]').setValue(true)
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([true])
  })

  it('applies active styling when on', () => {
    const wrapper = mount(UnsafeToggle, { props: { modelValue: true } })
    const shell = wrapper.find('[data-testid="unsafe-condition-toggle"]')
    expect(shell.classes().some((c) => c.includes('red'))).toBe(true)
  })
})
