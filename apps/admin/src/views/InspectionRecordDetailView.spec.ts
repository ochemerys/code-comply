import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import type { Pinia } from 'pinia'
import { createPinia, setActivePinia } from 'pinia'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { createRouter, createMemoryHistory } from 'vue-router'
import type { UserDTO } from '@codecomply/validators'
import InspectionRecordDetailView from './InspectionRecordDetailView.vue'
import { useAuthStore } from '../stores/auth'

const iso = () => new Date().toISOString()

const adminUser = (): UserDTO => ({
  id: 'admin',
  email: 'admin@test.com',
  name: 'Admin',
  role: 'ADMIN',
  disciplines: [],
  certifications: [],
  createdAt: iso(),
  updatedAt: iso(),
})

const sampleRecord = {
  inspectionId: 'insp-1',
  permitNumber: 'P-2025-001',
  address: '123 Main St',
  status: 'PASSED' as const,
  scheduledDate: iso(),
  finalizedAt: iso(),
  isFinalized: true,
  deficiencyCount: 0,
  deficiencies: [],
  hasCertificationSnapshot: false,
  addendums: [],
  appendOnlyMessage: 'Finalized inspection records are append-only.',
}

vi.mock('../composables/useAdminRecords', () => ({
  useAdminInspectionRecord: () => ({
    data: ref(sampleRecord),
    isPending: ref(false),
    error: ref(null),
    refetch: vi.fn(),
  }),
}))

vi.mock('../composables/useAdminAddendum', () => ({
  useAdminAddendumDetail: () => ({
    data: ref(null),
    isPending: ref(false),
  }),
  useAdminCreateAddendum: () => ({
    mutateAsync: vi.fn(),
    isPending: ref(false),
  }),
}))

vi.mock('../composables/useInspectionCertificationSnapshot', () => ({
  useInspectionCertificationSnapshot: () => ({
    data: ref(undefined),
    isPending: ref(false),
    error: ref(null),
  }),
}))

describe('InspectionRecordDetailView', () => {
  let pinia: Pinia

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    const auth = useAuthStore()
    auth.setUser(adminUser())
    auth.updateTokens({ accessToken: 'tok', refreshToken: 'ref', expiresIn: 3600 })
  })

  it('shows append-only notice and create addendum for finalized records', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        {
          path: '/compliance/records/:id',
          name: 'inspection-record',
          component: InspectionRecordDetailView,
        },
        {
          path: '/compliance/deficiencies',
          name: 'deficiencies',
          component: { template: '<div />' },
        },
        {
          path: '/compliance/deficiencies/new',
          name: 'deficiency-create',
          component: { template: '<div />' },
        },
        {
          path: '/compliance/deficiencies/:id',
          name: 'deficiency-detail',
          component: { template: '<div />' },
        },
      ],
    })
    await router.push('/compliance/records/insp-1')

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    const wrapper = mount(InspectionRecordDetailView, {
      global: { plugins: [pinia, router, [VueQueryPlugin, { queryClient }]] },
    })

    await flushPromises()

    expect(wrapper.find('[data-testid="record-append-only-notice"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="record-no-delete-notice"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="record-create-addendum"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('P-2025-001')
  })
})
