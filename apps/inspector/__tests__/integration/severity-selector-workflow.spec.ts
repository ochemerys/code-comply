/**
 * Integration: SeveritySelector inside DeficiencyForm (M6-S12).
 */
import { describe, it, expect } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent } from 'vue'
import DeficiencyForm from '@/components/DeficiencyForm.vue'

const CodeReferenceModalStub = defineComponent({
  name: 'CodeReferenceModal',
  props: { modelValue: Boolean },
  emits: ['update:modelValue', 'select'],
  template: '<div />',
})

describe('SeveritySelector workflow (integration)', () => {
  it('wires severity through DeficiencyForm with group label and touch targets', async () => {
    const wrapper = mount(DeficiencyForm, {
      props: { inspectionId: 'insp-m6s12' },
      global: { stubs: { CodeReferenceModal: CodeReferenceModalStub } },
    })
    await flushPromises()

    const group = wrapper.find('[data-testid="deficiency-severity"]')
    expect(group.attributes('role')).toBe('radiogroup')
    expect(group.attributes('aria-labelledby')).toBe('deficiency-severity-label')

    await wrapper
      .find('[data-testid="deficiency-description"]')
      .setValue('Corridor exit signage missing or not illuminated along egress path.')

    await wrapper.find('input[type="radio"][value="MAJOR"]').setValue(true)
    await wrapper.find('[data-testid="deficiency-form"]').trigger('submit.prevent')
    await flushPromises()

    const payload = wrapper.emitted('submit')?.[0]?.[0] as { severity: string }
    expect(payload?.severity).toBe('MAJOR')
  })
})
