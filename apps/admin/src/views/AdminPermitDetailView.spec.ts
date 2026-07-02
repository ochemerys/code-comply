import { describe, it, expect, vi } from 'vitest'
import { ref } from 'vue'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import AdminPermitDetailView from './AdminPermitDetailView.vue'

const permitData = ref<{
  id: string
  permitNumber: string
  address: string
  scope: string
  status: 'ACTIVE'
  legalLandDesc?: string
  createdAt: string
  updatedAt: string
  triage: {
    missingLld: boolean
    stopWorkLockedOut: boolean
    assignmentEligible: boolean
    blockReasons: string[]
    guidance: string[]
  }
}>({
  id: 'p-blank-lld',
  permitNumber: 'BP-2026-004990',
  address: 'Rural — Legal land description pending confirmation',
  scope: 'New Construction - Rural single family dwelling',
  status: 'ACTIVE',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  triage: {
    missingLld: true,
    stopWorkLockedOut: false,
    assignmentEligible: false,
    blockReasons: ['Missing legal land description'],
    guidance: [
      'Confirm the legal land description with the municipality before assigning an inspection.',
    ],
  },
})

vi.mock('../composables/useAdminPermits', () => ({
  isSessionExpiredRedirectError: () => false,
  useAdminPermitTriageDetail: () => ({
    data: permitData,
    isPending: ref(false),
    error: ref(null),
  }),
}))

async function mountView(permitId = 'p-blank-lld') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/permits', name: 'permits', component: { template: '<div />' } },
      {
        path: '/permits/:id',
        name: 'permit-detail',
        component: AdminPermitDetailView,
      },
      { path: '/compliance/search', name: 'compliance-search', component: { template: '<div />' } },
      { path: '/orders', name: 'orders', component: { template: '<div />' } },
    ],
  })
  await router.push({ name: 'permit-detail', params: { id: permitId } })
  return mount(AdminPermitDetailView, { global: { plugins: [router] } })
}

describe('AdminPermitDetailView', () => {
  it('surfaces missing LLD warning and assignment ineligibility', async () => {
    permitData.value = {
      id: 'p-blank-lld',
      permitNumber: 'BP-2026-004990',
      address: 'Rural — Legal land description pending confirmation',
      scope: 'New Construction - Rural single family dwelling',
      status: 'ACTIVE',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      triage: {
        missingLld: true,
        stopWorkLockedOut: false,
        assignmentEligible: false,
        blockReasons: ['Missing legal land description'],
        guidance: [
          'Confirm the legal land description with the municipality before assigning an inspection.',
        ],
      },
    }

    const wrapper = await mountView()
    expect(wrapper.get('[data-testid="admin-permit-detail-number"]').text()).toBe('BP-2026-004990')
    expect(wrapper.get('[data-testid="admin-permit-detail-missing-lld"]').text()).toMatch(
      /Missing legal land description/i,
    )
    expect(wrapper.get('[data-testid="admin-permit-detail-eligibility"]').text()).toMatch(
      /Not eligible/i,
    )
  })

  it('shows Stop Work lock-out banner when triage indicates lock-out', async () => {
    permitData.value = {
      id: 'p-stop-work',
      permitNumber: 'BP-2026-003001',
      address: '7018 Ada Boulevard NW, Edmonton, AB T5W 4J8',
      scope: 'Addition - Second storey',
      status: 'ACTIVE',
      legalLandDesc: 'Plan 8821XY Block 4 Lot 9',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      triage: {
        missingLld: false,
        stopWorkLockedOut: true,
        assignmentEligible: false,
        blockReasons: ['Active Stop Work order'],
        guidance: [
          'Assignment is locked until a Senior SCO overrides the Stop Work order or clearance is recorded.',
        ],
      },
    }

    const wrapper = await mountView('p-stop-work')
    expect(wrapper.get('[data-testid="admin-permit-detail-stop-work"]').text()).toMatch(
      /Stop Work lock-out/i,
    )
    expect(wrapper.get('[data-testid="admin-permit-detail-stop-work"]').text()).toMatch(
      /Senior SCO/i,
    )
  })
})
