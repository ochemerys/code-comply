import { describe, it, expect, vi } from 'vitest'
import { ref } from 'vue'
import { mount } from '@vue/test-utils'
import CodeLibraryView from './CodeLibraryView.vue'

const codeRows = ref<unknown[]>([])

vi.mock('../composables/useAdminCodeLibrary', () => ({
  isSessionExpiredRedirectError: () => false,
  useAdminCodeLibraryList: () => ({
    data: codeRows,
    isPending: ref(false),
    isFetching: ref(false),
    error: ref(null),
  }),
  useCreateCodeLibraryEntryMutation: () => ({
    mutateAsync: vi.fn(),
    isPending: ref(false),
  }),
  useUpdateCodeLibraryEntryMutation: () => ({
    mutateAsync: vi.fn(),
    isPending: ref(false),
  }),
}))

describe('CodeLibraryView', () => {
  it('renders the code library shell', () => {
    codeRows.value = []
    const wrapper = mount(CodeLibraryView)
    expect(wrapper.get('[data-testid="code-library-view"]').text()).toContain(
      'Manage safety code references',
    )
    expect(wrapper.find('[data-testid="code-library-add-button"]').exists()).toBe(true)
  })

  it('renders both desktop table and mobile card layouts', () => {
    codeRows.value = [
      {
        id: 'code-1',
        code: 'NBC 2019',
        section: '9.10.3',
        title: 'Fire separations',
        description: 'Required ratings',
      },
    ]
    const wrapper = mount(CodeLibraryView)

    const desktop = wrapper.get('[data-testid="code-library-desktop"]')
    expect(desktop.classes()).toContain('hidden')
    expect(desktop.classes()).toContain('md:block')
    expect(wrapper.find('[data-testid="code-library-row-code-1"]').exists()).toBe(true)

    const mobile = wrapper.get('[data-testid="code-library-mobile"]')
    expect(mobile.classes()).toContain('md:hidden')

    const card = wrapper.get('[data-testid="code-library-card-code-1"]')
    expect(card.text()).toContain('NBC 2019')
    expect(card.text()).toContain('9.10.3')
    expect(card.text()).toContain('Fire separations')
    expect(wrapper.find('[data-testid="code-library-card-edit-code-1"]').exists()).toBe(true)
  })
})
