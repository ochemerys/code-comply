import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent } from 'vue'
import CodeReferenceModal from './CodeReferenceModal.vue'

const CodeReferenceSearchStub = defineComponent({
  name: 'CodeReferenceSearch',
  emits: ['select'],
  template:
    '<div data-testid="code-reference-search-stub"><button type="button" data-testid="stub-select-code" @click="$emit(\'select\', { code: \'NBC\', section: \'9.10.1\', description: \'Test\' })">Pick</button></div>',
})

describe('CodeReferenceModal', () => {
  it('renders dialog when open', () => {
    const wrapper = mount(CodeReferenceModal, {
      props: { modelValue: true },
      global: {
        stubs: {
          teleport: true,
          CodeReferenceSearch: CodeReferenceSearchStub,
        },
      },
    })
    expect(wrapper.find('[data-testid="code-reference-modal"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="code-reference-modal-title"]').text()).toContain(
      'Select code reference',
    )
  })

  it('does not render when closed', () => {
    const wrapper = mount(CodeReferenceModal, {
      props: { modelValue: false },
      global: {
        stubs: {
          teleport: true,
          CodeReferenceSearch: CodeReferenceSearchStub,
        },
      },
    })
    expect(wrapper.find('[data-testid="code-reference-modal"]').exists()).toBe(false)
  })

  it('emits select and closes on selection', async () => {
    const wrapper = mount(CodeReferenceModal, {
      props: { modelValue: true },
      global: {
        stubs: {
          teleport: true,
          CodeReferenceSearch: CodeReferenceSearchStub,
        },
      },
    })
    await wrapper.find('[data-testid="stub-select-code"]').trigger('click')
    await flushPromises()
    expect(wrapper.emitted('select')?.[0]?.[0]).toEqual(
      expect.objectContaining({ code: 'NBC', section: '9.10.1' }),
    )
    expect(wrapper.emitted('update:modelValue')?.some((v) => v[0] === false)).toBe(true)
  })

  it('emits cancel and closes on Cancel', async () => {
    const wrapper = mount(CodeReferenceModal, {
      props: { modelValue: true },
      global: {
        stubs: {
          teleport: true,
          CodeReferenceSearch: CodeReferenceSearchStub,
        },
      },
    })
    await wrapper.find('[data-testid="code-reference-modal-cancel"]').trigger('click')
    expect(wrapper.emitted('cancel')).toBeTruthy()
    expect(wrapper.emitted('update:modelValue')?.some((v) => v[0] === false)).toBe(true)
  })

  it('closes on Escape', async () => {
    const wrapper = mount(CodeReferenceModal, {
      props: { modelValue: true },
      attachTo: document.body,
      global: {
        stubs: {
          teleport: true,
          CodeReferenceSearch: CodeReferenceSearchStub,
        },
      },
    })
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await flushPromises()
    expect(wrapper.emitted('cancel')).toBeTruthy()
    expect(wrapper.emitted('update:modelValue')?.some((v) => v[0] === false)).toBe(true)
  })
})
