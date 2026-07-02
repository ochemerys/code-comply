import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PassAllButton from './PassAllButton.vue'

describe('PassAllButton', () => {
  it('opens confirmation dialog when clicked', async () => {
    const wrapper = mount(PassAllButton, {
      props: { count: 4 },
      global: { stubs: { teleport: true } },
    })

    expect(wrapper.find('[data-testid="pass-all-dialog"]').exists()).toBe(false)
    await wrapper.get('[data-testid="checklist-pass-all"]').trigger('click')
    expect(wrapper.find('[data-testid="pass-all-dialog"]').exists()).toBe(true)
  })

  it('dialog shows correct count', async () => {
    const wrapper = mount(PassAllButton, {
      props: { count: 12 },
      global: { stubs: { teleport: true } },
    })

    await wrapper.get('[data-testid="checklist-pass-all"]').trigger('click')
    expect(wrapper.get('[data-testid="pass-all-dialog-message"]').text()).toContain('12')
  })

  it('confirm emits confirm and closes dialog', async () => {
    const wrapper = mount(PassAllButton, {
      props: { count: 2 },
      global: { stubs: { teleport: true } },
    })

    await wrapper.get('[data-testid="checklist-pass-all"]').trigger('click')
    await wrapper.get('[data-testid="pass-all-dialog-confirm"]').trigger('click')

    expect(wrapper.emitted('confirm')).toBeTruthy()
    expect(wrapper.find('[data-testid="pass-all-dialog"]').exists()).toBe(false)
  })

  it('cancel closes dialog without emitting confirm', async () => {
    const wrapper = mount(PassAllButton, {
      props: { count: 2 },
      global: { stubs: { teleport: true } },
    })

    await wrapper.get('[data-testid="checklist-pass-all"]').trigger('click')
    await wrapper.get('[data-testid="pass-all-dialog-cancel"]').trigger('click')

    expect(wrapper.emitted('confirm')).toBeFalsy()
    expect(wrapper.find('[data-testid="pass-all-dialog"]').exists()).toBe(false)
  })

  it('Escape closes dialog', async () => {
    const wrapper = mount(PassAllButton, {
      props: { count: 3 },
      attachTo: document.body,
      global: { stubs: { teleport: true } },
    })

    await wrapper.get('[data-testid="checklist-pass-all"]').trigger('click')
    expect(wrapper.find('[data-testid="pass-all-dialog"]').exists()).toBe(true)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="pass-all-dialog"]').exists()).toBe(false)
    wrapper.unmount()
  })
})
