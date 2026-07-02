import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import CodeReferenceSearch from './CodeReferenceSearch.vue'

const searchResults = ref<{ code: string; section: string; description?: string }[]>([])
const recentCodes = ref<{ code: string; section: string }[]>([{ code: 'NBC', section: '9.8.8' }])
const isSearching = ref(false)
const search = vi.fn(async () => {})
const select = vi.fn(async (code: string, section: string) => ({
  code,
  section,
  description: 'Resolved',
}))
const clearSearch = vi.fn(() => {
  searchResults.value = []
})

vi.mock('@/composables/useCodeReference', () => ({
  useCodeReference: () => ({
    searchResults,
    recentCodes,
    isSearching,
    search,
    select,
    clearSearch,
  }),
}))

describe('CodeReferenceSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    searchResults.value = []
    recentCodes.value = [{ code: 'NBC', section: '9.8.8' }]
    isSearching.value = false
  })

  it('lists recent codes when query is empty', () => {
    const wrapper = mount(CodeReferenceSearch)
    expect(wrapper.find('[data-testid="code-reference-recent-list"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Recent codes')
  })

  it('debounced search updates results section', async () => {
    vi.useFakeTimers()
    searchResults.value = [{ code: 'NBC', section: '9.10.1', description: 'Fire' }]
    const wrapper = mount(CodeReferenceSearch)
    await wrapper.find('[data-testid="code-reference-search-input"]').setValue('fire')
    await vi.advanceTimersByTimeAsync(320)
    await flushPromises()
    expect(search).toHaveBeenCalled()
    expect(wrapper.find('[data-testid="code-reference-results-list"]').exists()).toBe(true)
    vi.useRealTimers()
  })

  it('emits select with resolved reference when item picked', async () => {
    vi.useFakeTimers()
    searchResults.value = [{ code: 'NBC', section: '9.10.1' }]
    const wrapper = mount(CodeReferenceSearch)
    await wrapper.find('[data-testid="code-reference-search-input"]').setValue('x')
    await vi.advanceTimersByTimeAsync(320)
    await flushPromises()
    await wrapper.find('[data-testid="code-reference-item-NBC-9-10-1-result-0"]').trigger('click')
    await flushPromises()
    expect(select).toHaveBeenCalledWith('NBC', '9.10.1')
    const emitted = wrapper.emitted('select')
    expect(emitted?.[0]?.[0]).toEqual(
      expect.objectContaining({ code: 'NBC', section: '9.10.1', description: 'Resolved' }),
    )
    vi.useRealTimers()
  })
})
