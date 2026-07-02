import { describe, it, expect, vi } from 'vitest'
import { ref } from 'vue'
import { mount } from '@vue/test-utils'
import ChecklistTemplatesView from './ChecklistTemplatesView.vue'

const templateRows = ref<unknown[]>([])

vi.mock('../composables/useAdminChecklistTemplates', () => ({
  isSessionExpiredRedirectError: () => false,
  useAdminChecklistTemplatesList: () => ({
    data: templateRows,
    isPending: ref(false),
    isFetching: ref(false),
    error: ref(null),
  }),
}))

describe('ChecklistTemplatesView', () => {
  it('renders the checklist templates shell', () => {
    templateRows.value = []
    const wrapper = mount(ChecklistTemplatesView)
    expect(wrapper.get('[data-testid="checklist-templates-view"]').text()).toContain(
      'Build and publish inspection checklist templates',
    )
    expect(wrapper.find('[data-testid="checklist-templates-create-button"]').exists()).toBe(true)
  })

  it('renders both desktop table and mobile card layouts', () => {
    templateRows.value = [
      {
        id: 'tpl-1',
        name: 'Building Final',
        discipline: 'Building',
        version: 2,
        isActive: true,
        isLocked: true,
        versionHash: 'abc123def456',
      },
    ]
    const wrapper = mount(ChecklistTemplatesView)

    const desktop = wrapper.get('[data-testid="checklist-templates-desktop"]')
    expect(desktop.classes()).toContain('hidden')
    expect(desktop.classes()).toContain('md:block')
    expect(wrapper.find('[data-testid="checklist-template-row-tpl-1"]').exists()).toBe(true)

    const mobile = wrapper.get('[data-testid="checklist-templates-mobile"]')
    expect(mobile.classes()).toContain('md:hidden')

    const card = wrapper.get('[data-testid="checklist-template-card-tpl-1"]')
    expect(card.text()).toContain('Building Final')
    expect(card.text()).toContain('Building')
    expect(card.text()).toContain('2.0')
    expect(card.text()).toContain('Published')
    expect(wrapper.find('[data-testid="checklist-template-card-edit-tpl-1"]').exists()).toBe(true)
  })
})
