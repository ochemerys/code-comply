import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import DeleteDeficiencyDialog from './DeleteDeficiencyDialog.vue'
import type { LocalDeficiency } from '@/lib/db/types'

function mockRow(over: Partial<LocalDeficiency> = {}): LocalDeficiency {
  const now = new Date().toISOString()
  return {
    id: 'def-1',
    clientId: 'c1',
    inspectionId: 'insp-1',
    createdById: 'u1',
    description: 'Blocked exit requires attention on site immediately.',
    location: 'Stairwell B',
    severity: 'CRITICAL',
    status: 'OPEN',
    codeReference: undefined,
    isStopWork: false,
    isUnsafe: false,
    dueDate: undefined,
    createdAt: now,
    updatedAt: now,
    isDirty: false,
    syncedAt: now,
    ...over,
  }
}

describe('DeleteDeficiencyDialog', () => {
  it('does not render when closed', () => {
    const wrapper = mount(DeleteDeficiencyDialog, {
      props: { modelValue: false, deficiency: mockRow() },
      global: { stubs: { teleport: true } },
    })
    expect(wrapper.find('[data-testid="delete-deficiency-dialog"]').exists()).toBe(false)
  })

  it('does not render when deficiency is null', () => {
    const wrapper = mount(DeleteDeficiencyDialog, {
      props: { modelValue: true, deficiency: null },
      global: { stubs: { teleport: true } },
    })
    expect(wrapper.find('[data-testid="delete-deficiency-dialog"]').exists()).toBe(false)
  })

  it('renders title, message, and deficiency summary', () => {
    const row = mockRow()
    const wrapper = mount(DeleteDeficiencyDialog, {
      props: { modelValue: true, deficiency: row },
      global: { stubs: { teleport: true } },
    })
    expect(wrapper.find('[data-testid="delete-deficiency-dialog-title"]').text()).toContain(
      'Delete Deficiency?',
    )
    expect(wrapper.find('[data-testid="delete-deficiency-dialog-message"]').text()).toContain(
      'cannot be undone',
    )
    expect(wrapper.find('[data-testid="delete-deficiency-dialog-description"]').text()).toContain(
      'Blocked exit',
    )
    expect(wrapper.find('[data-testid="delete-deficiency-dialog-severity"]').text()).toContain(
      'Critical',
    )
  })

  it('truncates very long descriptions in summary', () => {
    const long = 'x'.repeat(250)
    const wrapper = mount(DeleteDeficiencyDialog, {
      props: { modelValue: true, deficiency: mockRow({ description: long }) },
      global: { stubs: { teleport: true } },
    })
    const text = wrapper.find('[data-testid="delete-deficiency-dialog-description"]').text()
    expect(text.length).toBeLessThanOrEqual(201)
    expect(text.endsWith('…')).toBe(true)
  })

  it('emits confirm when Delete is clicked', async () => {
    const wrapper = mount(DeleteDeficiencyDialog, {
      props: { modelValue: true, deficiency: mockRow(), deleting: false },
      global: { stubs: { teleport: true } },
    })
    await wrapper.find('[data-testid="delete-deficiency-dialog-confirm"]').trigger('click')
    expect(wrapper.emitted('confirm')).toBeTruthy()
    expect(wrapper.emitted('update:modelValue')).toBeFalsy()
  })

  it('does not emit confirm when deleting', async () => {
    const wrapper = mount(DeleteDeficiencyDialog, {
      props: { modelValue: true, deficiency: mockRow(), deleting: true },
      global: { stubs: { teleport: true } },
    })
    await wrapper.find('[data-testid="delete-deficiency-dialog-confirm"]').trigger('click')
    expect(wrapper.emitted('confirm')).toBeFalsy()
  })

  it('shows loading label and disables actions while deleting', () => {
    const wrapper = mount(DeleteDeficiencyDialog, {
      props: { modelValue: true, deficiency: mockRow(), deleting: true },
      global: { stubs: { teleport: true } },
    })
    expect(wrapper.find('[data-testid="delete-deficiency-dialog-deleting"]').exists()).toBe(true)
    const confirm = wrapper.find('[data-testid="delete-deficiency-dialog-confirm"]')
    const cancel = wrapper.find('[data-testid="delete-deficiency-dialog-cancel"]')
    expect(confirm.attributes('disabled')).toBeDefined()
    expect(cancel.attributes('disabled')).toBeDefined()
  })

  it('emits cancel and closes on Cancel', async () => {
    const wrapper = mount(DeleteDeficiencyDialog, {
      props: { modelValue: true, deficiency: mockRow() },
      global: { stubs: { teleport: true } },
    })
    await wrapper.find('[data-testid="delete-deficiency-dialog-cancel"]').trigger('click')
    expect(wrapper.emitted('cancel')).toBeTruthy()
    expect(wrapper.emitted('update:modelValue')?.some((v) => v[0] === false)).toBe(true)
  })

  it('shows error alert when error prop is set', () => {
    const wrapper = mount(DeleteDeficiencyDialog, {
      props: {
        modelValue: true,
        deficiency: mockRow(),
        error: 'Network failure',
      },
      global: { stubs: { teleport: true } },
    })
    const el = wrapper.find('[data-testid="delete-deficiency-dialog-error"]')
    expect(el.exists()).toBe(true)
    expect(el.text()).toContain('Network failure')
  })

  it('closes on Escape when not deleting', async () => {
    const wrapper = mount(DeleteDeficiencyDialog, {
      props: { modelValue: true, deficiency: mockRow() },
      attachTo: document.body,
      global: { stubs: { teleport: true } },
    })
    await nextTick()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(wrapper.emitted('cancel')).toBeTruthy()
    expect(wrapper.emitted('update:modelValue')?.some((v) => v[0] === false)).toBe(true)
    wrapper.unmount()
  })

  it('does not close on backdrop click while deleting', async () => {
    const wrapper = mount(DeleteDeficiencyDialog, {
      props: { modelValue: true, deficiency: mockRow(), deleting: true },
      global: { stubs: { teleport: true } },
    })
    await wrapper.find('[data-testid="delete-deficiency-dialog-overlay"]').trigger('click')
    expect(wrapper.emitted('cancel')).toBeFalsy()
  })

  it('closes on backdrop click when idle', async () => {
    const wrapper = mount(DeleteDeficiencyDialog, {
      props: { modelValue: true, deficiency: mockRow() },
      global: { stubs: { teleport: true } },
    })
    await wrapper.find('[data-testid="delete-deficiency-dialog-overlay"]').trigger('click')
    expect(wrapper.emitted('cancel')).toBeTruthy()
  })
})
