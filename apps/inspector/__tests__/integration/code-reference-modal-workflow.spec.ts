/**
 * Integration: Code reference modal + useCodeReference cache (M5-S14).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import CodeReferenceModal from '@/components/CodeReferenceModal.vue'
import {
  CODE_REFERENCE_LIBRARY_KEY,
  CODE_REFERENCE_RECENT_KEY,
} from '@/composables/useCodeReference'

describe('Code reference modal workflow (integration)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('selects a code from cached library offline and emits full reference', async () => {
    localStorage.setItem(
      CODE_REFERENCE_LIBRARY_KEY,
      JSON.stringify({
        entries: [
          {
            code: 'NBC',
            section: '3.4.1',
            title: 'Exits',
            description: 'Exit signs',
            cachedAt: new Date().toISOString(),
          },
        ],
      }),
    )

    const wrapper = mount(CodeReferenceModal, {
      props: { modelValue: true, itemLabel: 'Exit signs illuminated' },
      global: { stubs: { teleport: true } },
    })
    await flushPromises()

    await wrapper.find('[data-testid="code-reference-search-input"]').setValue('exit')
    await flushPromises()
    await vi.waitFor(
      () => {
        expect(wrapper.find('[data-testid="code-reference-results-list"]').exists()).toBe(true)
      },
      { timeout: 4000 },
    )

    await wrapper.find('[data-testid="code-reference-item-NBC-3-4-1-result-0"]').trigger('click')
    await flushPromises()

    const payload = wrapper.emitted('select')?.[0]?.[0] as { code: string; section: string }
    expect(payload).toEqual(expect.objectContaining({ code: 'NBC', section: '3.4.1' }))
    expect(wrapper.emitted('update:modelValue')?.some((v) => v[0] === false)).toBe(true)
  })

  it('shows recent codes without query when recent list is primed', async () => {
    localStorage.setItem(
      CODE_REFERENCE_RECENT_KEY,
      JSON.stringify([{ ref: { code: 'ABC', section: '1.1' }, usedAt: new Date().toISOString() }]),
    )

    const wrapper = mount(CodeReferenceModal, {
      props: { modelValue: true },
      global: { stubs: { teleport: true } },
    })
    await flushPromises()

    expect(wrapper.find('[data-testid="code-reference-recent-list"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="code-reference-item-ABC-1-1-recent-0"]').exists()).toBe(true)
  })
})
