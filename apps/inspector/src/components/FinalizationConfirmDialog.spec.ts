import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import FinalizationConfirmDialog from './FinalizationConfirmDialog.vue'

describe('FinalizationConfirmDialog', () => {
  it('emits confirm when primary button is clicked', async () => {
    const wrapper = mount(FinalizationConfirmDialog, {
      props: {
        modelValue: true,
        outcomeLabel: 'Acceptable',
        permitSummary: 'P-1 · 1 Main St',
      },
      global: {
        stubs: { Teleport: { template: '<div><slot /></div>' } },
      },
    })

    await wrapper.get('[data-testid="finalization-confirm-ok"]').trigger('click')
    expect(wrapper.emitted('confirm')).toBeTruthy()

    wrapper.unmount()
  })

  it('shows outcome and permit summary', () => {
    const wrapper = mount(FinalizationConfirmDialog, {
      props: {
        modelValue: true,
        outcomeLabel: 'Refused',
        permitSummary: 'BP-99 · Site Rd',
      },
      global: {
        stubs: { Teleport: { template: '<div><slot /></div>' } },
      },
    })

    expect(wrapper.get('[data-testid="finalization-confirm-outcome"]').text()).toContain('Refused')
    expect(wrapper.get('[data-testid="finalization-confirm-permit"]').text()).toContain('BP-99')

    wrapper.unmount()
  })

  it('disables buttons and shows loading label when loading', () => {
    const wrapper = mount(FinalizationConfirmDialog, {
      props: {
        modelValue: true,
        loading: true,
        outcomeLabel: 'Acceptable',
      },
      global: {
        stubs: { Teleport: { template: '<div><slot /></div>' } },
      },
    })

    const ok = wrapper.get('[data-testid="finalization-confirm-ok"]').element as HTMLButtonElement
    const cancel = wrapper.get('[data-testid="finalization-confirm-cancel"]')
      .element as HTMLButtonElement
    expect(ok.disabled).toBe(true)
    expect(cancel.disabled).toBe(true)
    expect(wrapper.get('[data-testid="finalization-confirm-ok"]').text()).toContain('Finalizing')

    wrapper.unmount()
  })
})
