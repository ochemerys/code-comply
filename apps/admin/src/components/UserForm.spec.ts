import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import UserForm, { type UserFormModel } from './UserForm.vue'

const emptyForm = (): UserFormModel => ({
  name: '',
  designationId: '',
  disciplinesCsv: '',
  authoritiesCsv: '',
  certificationExpiry: '',
})

describe('UserForm', () => {
  it('shows read-only email and role', () => {
    const wrapper = mount(UserForm, {
      props: {
        email: 'inspector@test.com',
        roleLabel: 'SCO',
        modelValue: emptyForm(),
        'onUpdate:modelValue': () => {},
      },
    })
    expect(wrapper.get('[data-testid="user-form-email"]').text()).toContain('inspector@test.com')
    expect(wrapper.get('[data-testid="user-form-role"]').text()).toContain('SCO')
  })

  it('reflects modelValue in fields and updates when modelValue prop changes', async () => {
    const wrapper = mount(UserForm, {
      props: {
        email: 'a@b.com',
        roleLabel: 'ADMIN',
        modelValue: { ...emptyForm(), name: 'Start' },
        'onUpdate:modelValue': () => {},
      },
    })

    expect((wrapper.get('[data-testid="user-form-name"]').element as HTMLInputElement).value).toBe(
      'Start',
    )

    await wrapper.setProps({
      modelValue: { ...emptyForm(), name: 'FromParent' },
    })
    expect((wrapper.get('[data-testid="user-form-name"]').element as HTMLInputElement).value).toBe(
      'FromParent',
    )
  })

  it('respects disabled on inputs', () => {
    const wrapper = mount(UserForm, {
      props: {
        email: 'a@b.com',
        roleLabel: 'ADMIN',
        modelValue: emptyForm(),
        'onUpdate:modelValue': () => {},
        disabled: true,
      },
    })
    expect(wrapper.get('[data-testid="user-form-name"]').attributes('disabled')).toBeDefined()
  })
})
