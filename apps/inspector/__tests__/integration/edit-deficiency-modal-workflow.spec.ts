/**
 * Integration: Edit deficiency modal + DeficiencyForm seeding (M6-S10).
 */
import { describe, it, expect } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent } from 'vue'
import EditDeficiencyModal from '@/components/EditDeficiencyModal.vue'
import type { LocalDeficiency } from '@/lib/db/types'

const CodeReferenceModalStub = defineComponent({
  name: 'CodeReferenceModal',
  props: { modelValue: Boolean },
  emits: ['update:modelValue', 'select'],
  template: '<div />',
})

function mockRow(): LocalDeficiency {
  const now = new Date().toISOString()
  return {
    id: 'def-int',
    clientId: 'c-int',
    inspectionId: 'insp-int',
    checklistItemId: 'chk-1',
    createdById: 'u1',
    description: 'Blocked exit path requires immediate attention on site.',
    location: 'Stairwell B',
    severity: 'CRITICAL',
    status: 'OPEN',
    codeReference: { code: 'NBC', section: '3.4', title: 'Exits' },
    isStopWork: false,
    isUnsafe: true,
    dueDate: '2026-06-15T00:00:00.000Z',
    createdAt: now,
    updatedAt: now,
    isDirty: false,
    syncedAt: now,
  }
}

describe('Edit deficiency modal workflow (integration)', () => {
  it('opens with current field values from the deficiency row', async () => {
    const row = mockRow()
    const wrapper = mount(EditDeficiencyModal, {
      props: {
        modelValue: true,
        inspectionId: row.inspectionId,
        deficiency: row,
        submitting: false,
      },
      global: {
        stubs: {
          teleport: true,
          CodeReferenceModal: CodeReferenceModalStub,
        },
      },
    })
    await flushPromises()

    const desc = wrapper.find('[data-testid="deficiency-description"]')
      .element as HTMLTextAreaElement
    expect(desc.value).toBe(row.description)

    const criticalRadio = wrapper.find('input[type="radio"][value="CRITICAL"]')
      .element as HTMLInputElement
    expect(criticalRadio.checked).toBe(true)

    const loc = wrapper.find('[data-testid="deficiency-location"]').element as HTMLInputElement
    expect(loc.value).toBe('Stairwell B')

    expect(wrapper.find('[data-testid="deficiency-code-summary"]').text()).toMatch(/NBC/)
    const unsafe = wrapper.find('[data-testid="deficiency-flag-unsafe"]')
      .element as HTMLInputElement
    expect(unsafe.checked).toBe(true)
  })

  it('emits close when cancel is used after field edits (offline-friendly flow)', async () => {
    const row = mockRow()
    const wrapper = mount(EditDeficiencyModal, {
      props: {
        modelValue: true,
        inspectionId: row.inspectionId,
        deficiency: row,
      },
      global: {
        stubs: { teleport: true, CodeReferenceModal: CodeReferenceModalStub },
      },
    })
    await flushPromises()

    await wrapper.find('[data-testid="deficiency-location"]').setValue('Roof access')
    expect(wrapper.find('[data-testid="edit-deficiency-modal"]').exists()).toBe(true)

    await wrapper.find('[data-testid="deficiency-cancel"]').trigger('click')
    expect(wrapper.emitted('cancel')).toBeTruthy()
    expect(wrapper.emitted('update:modelValue')?.some((v) => v[0] === false)).toBe(true)
  })
})
