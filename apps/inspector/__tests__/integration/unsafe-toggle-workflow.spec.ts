/**
 * Integration: UnsafeToggle inside DeficiencyForm + submit payload (M6-S16).
 */
import { describe, it, expect } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent } from 'vue'
import DeficiencyForm from '@/components/DeficiencyForm.vue'
import type { DeficiencyFormPayload } from '@/components/deficiency-form.types'

const CodeReferenceModalStub = defineComponent({
  name: 'CodeReferenceModal',
  props: { modelValue: Boolean },
  emits: ['update:modelValue', 'select'],
  template: '<div />',
})

describe('Unsafe toggle workflow (integration)', () => {
  it('includes UnsafeToggle and emits isUnsafe in submit payload', async () => {
    const wrapper = mount(DeficiencyForm, {
      props: { inspectionId: 'insp-int' },
      global: { stubs: { CodeReferenceModal: CodeReferenceModalStub } },
    })
    await flushPromises()

    expect(wrapper.find('[data-testid="unsafe-condition-toggle"]').exists()).toBe(true)

    await wrapper
      .find('[data-testid="deficiency-description"]')
      .setValue('Hazardous wiring exposed in corridor requires immediate review on site.')
    await wrapper.find('[data-testid="deficiency-flag-unsafe"]').setValue(true)
    await wrapper.find('[data-testid="deficiency-form"]').trigger('submit.prevent')
    await flushPromises()

    const payload = wrapper.emitted('submit')?.[0]?.[0] as DeficiencyFormPayload
    expect(payload.isUnsafe).toBe(true)
  })
})
