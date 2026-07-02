/**
 * Unit tests for PermitSearch component (M4-S9)
 * Search input only; results appear in "Your permit list" below. Tests v-model and clear.
 */
import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import { mount } from '@vue/test-utils'
import PermitSearch from './PermitSearch.vue'

describe('PermitSearch', () => {
  describe('rendering', () => {
    it('renders search input and label', () => {
      const wrapper = mount(PermitSearch, {
        props: { searchQuery: '' },
        attrs: { 'onUpdate:searchQuery': () => {} },
      })
      const input = wrapper.find('#permit-search-input')
      expect(input.exists()).toBe(true)
      expect(input.attributes('placeholder')).toContain('BP-2024-001')
      expect(wrapper.text()).toContain('Search in your list')
    })

    it('does not show Clear button when query is empty', () => {
      const wrapper = mount(PermitSearch, {
        props: { searchQuery: '' },
      })
      expect(wrapper.find('[data-testid="permit-search-clear"]').exists()).toBe(false)
    })

    it('shows Clear button when query is not empty', () => {
      const wrapper = mount(PermitSearch, {
        props: { searchQuery: 'ab' },
      })
      expect(wrapper.find('[data-testid="permit-search-clear"]').exists()).toBe(true)
    })

    it('shows "Type at least 2 characters" when query length is 1', () => {
      const wrapper = mount(PermitSearch, {
        props: { searchQuery: 'a' },
      })
      expect(wrapper.text()).toContain('Type at least 2 characters')
    })

    it('does not render result cards (results live in list below)', () => {
      const wrapper = mount(PermitSearch, {
        props: { searchQuery: 'xy' },
      })
      expect(wrapper.find('[data-testid="permit-search-result"]').exists()).toBe(false)
    })
  })

  describe('v-model and clear', () => {
    it('emits update:searchQuery when user types', async () => {
      const searchQuery = ref('')
      const wrapper = mount(PermitSearch, {
        props: { searchQuery: searchQuery.value },
        attrs: {
          'onUpdate:searchQuery': (v: string) => {
            searchQuery.value = v
          },
        },
      })
      const input = wrapper.find('#permit-search-input')
      await input.setValue('BP-2024')
      expect(wrapper.emitted('update:searchQuery')).toBeTruthy()
      expect(wrapper.emitted('update:searchQuery')!.slice(-1)[0]).toEqual(['BP-2024'])
    })

    it('clicking Clear emits update:searchQuery with empty string', async () => {
      const wrapper = mount(PermitSearch, {
        props: { searchQuery: 'ab' },
      })
      await wrapper.find('[data-testid="permit-search-clear"]').trigger('click')
      expect(wrapper.emitted('update:searchQuery')).toEqual([['']])
    })
  })
})
