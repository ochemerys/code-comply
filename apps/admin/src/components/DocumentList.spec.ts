import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import type { DocumentDTO, ReportDTO } from '@codecomply/validators'
import DocumentList from './DocumentList.vue'

vi.mock('../composables/useAdminDocuments', () => ({
  documentSignedAt: () => null,
  reportTypeLabel: (t: string) => (t === 'INSPECTION' ? 'Inspection Report' : t),
  useDeleteDocumentMutation: () => ({ mutateAsync: vi.fn(), isPending: ref(false) }),
  useDocumentDownloadMutation: () => ({ mutateAsync: vi.fn(), isPending: ref(false) }),
  useEmailDocumentMutation: () => ({ mutateAsync: vi.fn(), isPending: ref(false) }),
  useReportFormatDownloadMutation: () => ({ mutateAsync: vi.fn(), isPending: ref(false) }),
  useSignDocumentMutation: () => ({ mutateAsync: vi.fn(), isPending: ref(false) }),
  useSignReportMutation: () => ({ mutateAsync: vi.fn(), isPending: ref(false) }),
}))

vi.mock('../composables/useAdminReports', () => ({
  useDistributeReportMutation: () => ({ mutateAsync: vi.fn(), isPending: ref(false) }),
}))

const iso = () => new Date().toISOString()

const uploaded = [
  { id: 'doc-1', filename: 'site-photo.jpg', createdAt: iso() } as unknown as DocumentDTO,
]

const generated = [
  {
    id: 'rep-1',
    type: 'INSPECTION',
    filename: 'inspection-report.pdf',
    generatedAt: iso(),
  } as unknown as ReportDTO,
]

describe('DocumentList', () => {
  it('renders both desktop table and mobile cards for uploaded documents', () => {
    const wrapper = mount(DocumentList, {
      props: { inspectionId: 'insp-1', kind: 'uploaded', uploaded },
      global: { stubs: { DocumentSignaturePad: true } },
    })

    const desktop = wrapper.get('[data-testid="document-list-desktop"]')
    expect(desktop.classes()).toContain('hidden')
    expect(desktop.classes()).toContain('md:block')
    expect(wrapper.find('[data-testid="document-uploaded-row-doc-1"]').exists()).toBe(true)

    const mobile = wrapper.get('[data-testid="document-list-mobile"]')
    expect(mobile.classes()).toContain('md:hidden')

    const card = wrapper.get('[data-testid="document-uploaded-card-doc-1"]')
    expect(card.text()).toContain('site-photo.jpg')
    expect(card.text()).toContain('Download')
  })

  it('renders both desktop table and mobile cards for generated documents', () => {
    const wrapper = mount(DocumentList, {
      props: { inspectionId: 'insp-1', kind: 'generated', generated },
      global: { stubs: { DocumentSignaturePad: true } },
    })

    expect(wrapper.get('[data-testid="document-list-desktop"]').classes()).toContain('md:block')

    const mobile = wrapper.get('[data-testid="document-list-mobile"]')
    expect(mobile.classes()).toContain('md:hidden')

    const card = wrapper.get('[data-testid="document-generated-card-rep-1"]')
    expect(card.text()).toContain('Inspection Report')
    expect(card.text()).toContain('inspection-report.pdf')
    expect(card.text()).toContain('PDF')
    expect(card.text()).toContain('Word')
  })
})
