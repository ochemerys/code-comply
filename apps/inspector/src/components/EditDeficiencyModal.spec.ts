import { describe, it, expect } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, nextTick } from 'vue'
import EditDeficiencyModal from './EditDeficiencyModal.vue'
import type { LocalDeficiency } from '@/lib/db/types'

const DeficiencyFormStub = defineComponent({
  name: 'DeficiencyForm',
  props: {
    variant: String,
    inspectionId: String,
    checklistItemId: String,
    initialDeficiency: Object,
    submitting: Boolean,
  },
  emits: ['submit', 'cancel'],
  template:
    '<div data-testid="deficiency-form-stub">' +
    "<button type=\"button\" data-testid=\"stub-submit\" @click=\"$emit('submit', { inspectionId, description: 'x'.repeat(12), severity: 'MINOR', location: '', codeReference: undefined, dueDate: undefined, isStopWork: false, isUnsafe: false, checklistItemId })\">Save</button>" +
    '<button type="button" data-testid="stub-cancel" @click="$emit(\'cancel\')">Cancel</button>' +
    '</div>',
})

function mockRow(over: Partial<LocalDeficiency> = {}): LocalDeficiency {
  const now = new Date().toISOString()
  return {
    id: 'def-1',
    clientId: 'c1',
    inspectionId: 'insp-1',
    checklistItemId: 'item-1',
    createdById: 'u1',
    description: 'Initial description long enough.',
    location: 'Room A',
    severity: 'MAJOR',
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

describe('EditDeficiencyModal', () => {
  it('does not render when closed', () => {
    const wrapper = mount(EditDeficiencyModal, {
      props: {
        modelValue: false,
        inspectionId: 'insp-1',
        deficiency: mockRow(),
      },
      global: { stubs: { teleport: true, DeficiencyForm: DeficiencyFormStub } },
    })
    expect(wrapper.find('[data-testid="edit-deficiency-modal"]').exists()).toBe(false)
  })

  it('does not render when deficiency is null', () => {
    const wrapper = mount(EditDeficiencyModal, {
      props: {
        modelValue: true,
        inspectionId: 'insp-1',
        deficiency: null,
      },
      global: { stubs: { teleport: true, DeficiencyForm: DeficiencyFormStub } },
    })
    expect(wrapper.find('[data-testid="edit-deficiency-modal"]').exists()).toBe(false)
  })

  it('renders dialog and forwards props to DeficiencyForm when open', () => {
    const row = mockRow()
    const wrapper = mount(EditDeficiencyModal, {
      props: {
        modelValue: true,
        inspectionId: 'insp-99',
        deficiency: row,
        submitting: true,
      },
      global: { stubs: { teleport: true, DeficiencyForm: DeficiencyFormStub } },
    })
    expect(wrapper.find('[data-testid="edit-deficiency-modal"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="edit-deficiency-modal-title"]').text()).toContain(
      'Edit deficiency',
    )
    const form = wrapper.findComponent(DeficiencyFormStub)
    expect(form.props('variant')).toBe('edit')
    expect(form.props('inspectionId')).toBe('insp-99')
    expect(form.props('checklistItemId')).toBe('item-1')
    expect(form.props('initialDeficiency')).toEqual(row)
    expect(form.props('submitting')).toBe(true)
  })

  it('emits submit and does not auto-close (parent closes after save)', async () => {
    const wrapper = mount(EditDeficiencyModal, {
      props: {
        modelValue: true,
        inspectionId: 'insp-1',
        deficiency: mockRow(),
      },
      global: { stubs: { teleport: true, DeficiencyForm: DeficiencyFormStub } },
    })
    await wrapper.find('[data-testid="stub-submit"]').trigger('click')
    await flushPromises()
    expect(wrapper.emitted('submit')?.[0]?.[0]).toMatchObject({
      description: 'xxxxxxxxxxxx',
      severity: 'MINOR',
    })
    expect(wrapper.emitted('update:modelValue')).toBeFalsy()
  })

  it('emits cancel and closes on form cancel', async () => {
    const wrapper = mount(EditDeficiencyModal, {
      props: {
        modelValue: true,
        inspectionId: 'insp-1',
        deficiency: mockRow(),
      },
      global: { stubs: { teleport: true, DeficiencyForm: DeficiencyFormStub } },
    })
    await wrapper.find('[data-testid="stub-cancel"]').trigger('click')
    expect(wrapper.emitted('cancel')).toBeTruthy()
    expect(wrapper.emitted('update:modelValue')?.some((v) => v[0] === false)).toBe(true)
  })

  it('closes on Escape', async () => {
    const wrapper = mount(EditDeficiencyModal, {
      props: {
        modelValue: true,
        inspectionId: 'insp-1',
        deficiency: mockRow(),
      },
      attachTo: document.body,
      global: { stubs: { teleport: true, DeficiencyForm: DeficiencyFormStub } },
    })
    await nextTick()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(wrapper.emitted('cancel')).toBeTruthy()
    expect(wrapper.emitted('update:modelValue')?.some((v) => v[0] === false)).toBe(true)
    wrapper.unmount()
  })

  it('closes on backdrop click', async () => {
    const wrapper = mount(EditDeficiencyModal, {
      props: {
        modelValue: true,
        inspectionId: 'insp-1',
        deficiency: mockRow(),
      },
      global: { stubs: { teleport: true, DeficiencyForm: DeficiencyFormStub } },
    })
    const overlay = wrapper.find('[data-testid="edit-deficiency-modal-overlay"]')
    await overlay.trigger('click')
    expect(wrapper.emitted('cancel')).toBeTruthy()
    expect(wrapper.emitted('update:modelValue')?.some((v) => v[0] === false)).toBe(true)
  })
})
