/**
 * Integration tests for Permit Detail View (M4-S11).
 * Uses real IndexedDB (fake-indexeddb), usePermitDetail fallback, and PermitDetailView.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import { db } from '../../src/lib/db'
import PermitDetailView from '../../src/views/PermitDetailView.vue'
import PermitsView from '../../src/views/PermitsView.vue'
import type { LocalPermit } from '../../src/lib/db/types'

const mockFetch = vi.fn()
beforeEach(() => {
  global.fetch = mockFetch
  Object.defineProperty(navigator, 'onLine', { value: false, writable: true })
})

function toLocalPermit(
  id: string,
  permitNumber: string,
  address: string,
  status: LocalPermit['status'],
  overrides: Partial<LocalPermit> = {},
): LocalPermit {
  return {
    id,
    permitNumber,
    address,
    status,
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('Permit Detail View Integration', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    await db.permits.clear()
    await db.inspections.clear()
  })

  it('displays cached permit when offline', async () => {
    await db.permits.add(toLocalPermit('p1', 'BP-2024-001', '123 Main St, Calgary AB', 'ACTIVE'))

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/permits', name: 'permits', component: PermitsView },
        { path: '/permits/:id', name: 'permit-detail', component: PermitDetailView },
      ],
    })
    await router.push({ name: 'permit-detail', params: { id: 'p1' } })

    const wrapper = mount(PermitDetailView, {
      global: { plugins: [router, createPinia()] },
    })
    await flushPromises()
    await new Promise((r) => setTimeout(r, 100))

    expect(wrapper.text()).toContain('Permit details')
    expect(wrapper.text()).toContain('BP-2024-001')
    expect(wrapper.text()).toContain('123 Main St, Calgary AB')
    expect(wrapper.text()).toContain('Permit Information')
    expect(wrapper.text()).toContain('Location Details')
    expect(wrapper.text()).toContain('Scheduled Inspections')
  })

  it('shows not found when permit id not in cache and offline', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/permits', name: 'permits', component: PermitsView },
        { path: '/permits/:id', name: 'permit-detail', component: PermitDetailView },
      ],
    })
    await router.push({ name: 'permit-detail', params: { id: 'nonexistent' } })

    const wrapper = mount(PermitDetailView, {
      global: { plugins: [router, createPinia()] },
    })
    await flushPromises()
    await new Promise((r) => setTimeout(r, 100))

    expect(wrapper.find('[data-testid="permit-detail-not-found"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Permit not found')
  })
})
