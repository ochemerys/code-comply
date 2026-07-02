import { describe, it, expect, vi } from 'vitest'
import { ref } from 'vue'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import PermitsView from './PermitsView.vue'

const syncIsPending = ref(false)
const syncStatusData = ref<{ status: string; lastSyncedAt: string | null }>({
  status: 'idle',
  lastSyncedAt: null,
})
const permitsListData = ref([
  {
    id: 'p-1',
    permitNumber: 'BP-2024-001',
    address: '123 Main St',
    legalLandDesc: 'Plan 1234AB Block 5 Lot 12',
    status: 'ACTIVE',
    triage: {
      missingLld: false,
      stopWorkLockedOut: false,
      assignmentEligible: true,
      blockReasons: [],
      guidance: [],
    },
  },
  {
    id: 'p-2',
    permitNumber: 'BP-2026-004990',
    address: 'Rural address',
    legalLandDesc: undefined,
    status: 'ACTIVE',
    triage: {
      missingLld: true,
      stopWorkLockedOut: false,
      assignmentEligible: false,
      blockReasons: ['Missing legal land description'],
      guidance: [
        'Confirm the legal land description with the municipality before assigning an inspection.',
      ],
    },
  },
])

vi.mock('../composables/useAdminPermits', () => ({
  isSessionExpiredRedirectError: () => false,
  useAdminPermitsList: () => ({
    data: permitsListData,
    isPending: ref(false),
    isFetching: ref(false),
    error: ref(null),
    refetch: vi.fn(),
  }),
  usePermitSyncStatus: () => ({
    data: syncStatusData,
  }),
  usePermitSyncMutation: () => ({
    mutateAsync: vi.fn(),
    isPending: syncIsPending,
  }),
}))

vi.mock('../composables/useAdminAuditLogs', () => ({
  usePermitSyncAuditLogs: () => ({
    data: ref({
      entries: [
        {
          id: 'audit-1',
          entityType: 'Permit',
          entityId: 'municipal',
          action: 'PERMIT_SYNC',
          userId: 'admin-1',
          timestamp: '2026-06-07T12:00:00.000Z',
          metadata: { newPermits: 1, updatedPermits: 0, unchanged: 21 },
        },
      ],
      total: 1,
    }),
    refetch: vi.fn(),
  }),
}))

function mountView() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/permits', name: 'permits', component: { template: '<div />' } },
      { path: '/permits/:id', name: 'permit-detail', component: { template: '<div />' } },
      { path: '/compliance/search', name: 'compliance-search', component: { template: '<div />' } },
    ],
  })
  return mount(PermitsView, { global: { plugins: [router] } })
}

describe('PermitsView', () => {
  it('shows syncing state in the municipal sync status bar while sync is in progress', () => {
    syncIsPending.value = true
    syncStatusData.value = { status: 'success', lastSyncedAt: '2026-06-07T12:00:00.000Z' }

    const wrapper = mountView()
    const statusBar = wrapper.get('[data-testid="permits-sync-status"]')

    expect(statusBar.text()).toMatch(/syncing/i)
    expect(wrapper.find('[data-testid="permits-sync-running-indicator"]').exists()).toBe(true)
  })

  it('renders both desktop table and mobile card layouts', () => {
    syncIsPending.value = false
    syncStatusData.value = { status: 'idle', lastSyncedAt: null }
    const wrapper = mountView()

    const desktop = wrapper.get('[data-testid="permits-desktop"]')
    expect(desktop.classes()).toContain('hidden')
    expect(desktop.classes()).toContain('md:block')
    expect(wrapper.find('[data-testid="permits-row-BP-2024-001"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="permits-lld-BP-2024-001"]').text()).toContain(
      'Plan 1234AB Block 5 Lot 12',
    )

    const mobile = wrapper.get('[data-testid="permits-mobile"]')
    expect(mobile.classes()).toContain('md:hidden')

    const card = wrapper.get('[data-testid="permits-card-BP-2024-001"]')
    expect(card.text()).toContain('BP-2024-001')
    expect(card.text()).toContain('123 Main St')
    expect(card.text()).toContain('ACTIVE')
    expect(wrapper.find('[data-testid="permits-card-search-BP-2024-001"]').exists()).toBe(true)
  })

  it('links permit rows to the triage detail view and shows missing-LLD flag', () => {
    syncIsPending.value = false
    const wrapper = mountView()
    const openLink = wrapper.get('[data-testid="permits-open-BP-2026-004990"]')
    expect(openLink.attributes('href')).toBe('/permits/p-2')
    expect(wrapper.get('[data-testid="permits-flag-missing-lld-BP-2026-004990"]').text()).toBe(
      'Missing LLD',
    )
  })

  it('shows recent PERMIT_SYNC audit log entries', () => {
    syncIsPending.value = false
    const wrapper = mountView()
    const auditSection = wrapper.get('[data-testid="permits-sync-audit-log"]')
    expect(auditSection.text()).toMatch(/PERMIT_SYNC/i)
    expect(auditSection.text()).toContain('New:')
    expect(auditSection.text()).toContain('1')
    expect(wrapper.find('[data-testid="permits-sync-audit-entry-audit-1"]').exists()).toBe(true)
  })
})
