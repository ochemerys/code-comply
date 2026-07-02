import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import DocumentHubView from './DocumentHubView.vue'

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { id: 'insp-1' } }),
  RouterLink: { template: '<a><slot /></a>' },
}))

vi.mock('../composables/useAdminInspectionDetail', () => ({
  useAdminInspectionWorkflow: () => ({
    data: ref({
      inspectionId: 'insp-1',
      permitNumber: 'P-1',
      address: '1 Main St',
      status: 'IN_PROGRESS',
      isFinalized: false,
    }),
    isPending: ref(false),
    error: ref(null),
  }),
}))

vi.mock('../composables/useAdminDocuments', () => ({
  isSessionExpiredRedirectError: () => false,
  useInspectionUploadedDocuments: () => ({
    data: ref([]),
    isPending: ref(false),
    refetch: vi.fn(),
  }),
  useInspectionGeneratedDocuments: () => ({
    data: ref([]),
    isPending: ref(false),
    refetch: vi.fn(),
  }),
}))

vi.mock('../stores/auth', () => ({
  useAuthStore: () => ({ isAdmin: true }),
}))

describe('DocumentHubView', () => {
  it('renders tabs and summary', () => {
    const wrapper = mount(DocumentHubView, {
      global: { stubs: ['DocumentList', 'DocumentUploadPanel', 'ReportGenerator'] },
    })
    expect(wrapper.find('[data-testid="document-hub-view"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="document-hub-tab-generated"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="document-hub-tab-uploaded"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('P-1')
  })
})
