import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import Button from './Button.vue'

describe('Button', () => {
  it('renders slot content', () => {
    const wrapper = mount(Button, {
      slots: {
        default: 'Click me',
      },
    })
    expect(wrapper.text()).toContain('Click me')
  })

  it('applies primary variant', () => {
    const wrapper = mount(Button, {
      props: { variant: 'primary' },
    })
    expect(wrapper.classes().join(' ')).toContain('bg-blue-600')
  })

  it('supports ghost variant', () => {
    const wrapper = mount(Button, {
      props: { variant: 'ghost' },
    })
    expect(wrapper.classes().join(' ')).toContain('bg-transparent')
  })

  it('applies active scale interaction', () => {
    const wrapper = mount(Button)
    expect(wrapper.classes()).toContain('active:scale-95')
  })

  it('applies full width when block is true', () => {
    const wrapper = mount(Button, {
      props: { block: true },
    })
    expect(wrapper.classes()).toContain('w-full')
  })

  it('maps size md to touch-friendly height', () => {
    const wrapper = mount(Button, {
      props: { size: 'md' },
    })
    expect(wrapper.classes()).toContain('h-11')
  })
})
