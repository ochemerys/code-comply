import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import DeficiencyCard from './DeficiencyCard.vue'
import type { LocalDeficiency } from '@/lib/db/types'

function routerWithDetail() {
  return createRouter({
    history: createMemoryHistory('/'),
    routes: [
      { path: '/', name: 'home', component: { template: '<div />' } },
      {
        path: '/inspections/:inspectionId/deficiencies/:deficiencyId',
        name: 'deficiency-detail',
        component: { template: '<div />' },
      },
    ],
  })
}

function row(overrides: Partial<LocalDeficiency> = {}): LocalDeficiency {
  return {
    id: 'def-1',
    clientId: 'c1',
    inspectionId: 'insp-1',
    createdById: 'u1',
    description: 'A'.repeat(150),
    location: 'Basement east',
    severity: 'MAJOR',
    status: 'OPEN',
    isStopWork: false,
    isUnsafe: false,
    dueDate: '2026-06-01',
    createdAt: '2026-04-01T12:00:00.000Z',
    updatedAt: '2026-04-01T12:00:00.000Z',
    isDirty: false,
    ...overrides,
  }
}

describe('DeficiencyCard', () => {
  it('renders severity and status badges with labels', () => {
    const router = routerWithDetail()
    const wrapper = mount(DeficiencyCard, {
      props: { deficiency: row({ severity: 'CRITICAL', status: 'VOC_SUBMITTED' }) },
      global: { plugins: [router] },
    })
    const sev = wrapper.find('[data-testid="deficiency-card-severity"]')
    const st = wrapper.find('[data-testid="deficiency-card-status"]')
    expect(sev.text()).toContain('Critical')
    expect(st.text()).toContain('VOC submitted')
    expect(sev.classes().some((c) => c.includes('red'))).toBe(true)
  })

  it('truncates long description', () => {
    const router = routerWithDetail()
    const wrapper = mount(DeficiencyCard, {
      props: { deficiency: row(), descriptionMax: 20 },
      global: { plugins: [router] },
    })
    const el = wrapper.find('[data-testid="deficiency-card-description"]')
    expect(el.text().length).toBeLessThanOrEqual(21)
    expect(el.text()).toMatch(/…$/)
  })

  it('shows location, due date, and created date', () => {
    const router = routerWithDetail()
    const wrapper = mount(DeficiencyCard, {
      props: { deficiency: row() },
      global: { plugins: [router] },
    })
    expect(wrapper.find('[data-testid="deficiency-card-location"]').text()).toContain('Basement')
    expect(wrapper.find('[data-testid="deficiency-card-due"]').text()).not.toBe('—')
    expect(wrapper.find('[data-testid="deficiency-card-created"]').text()).not.toBe('—')
  })

  it('shows stop work chip when isStopWork', () => {
    const router = routerWithDetail()
    const wrapper = mount(DeficiencyCard, {
      props: { deficiency: row({ isStopWork: true }) },
      global: { plugins: [router] },
    })
    expect(wrapper.find('[data-testid="deficiency-card-stop-work"]').exists()).toBe(true)
  })

  it('shows unsafe chip and highlight when isUnsafe (M6-S16)', () => {
    const router = routerWithDetail()
    const wrapper = mount(DeficiencyCard, {
      props: { deficiency: row({ isUnsafe: true, isStopWork: false }) },
      global: { plugins: [router] },
    })
    expect(wrapper.find('[data-testid="deficiency-card-unsafe"]').exists()).toBe(true)
    const card = wrapper.find('[data-testid="deficiency-card-def-1"]')
    expect(card.classes().some((c) => c.includes('red'))).toBe(true)
  })

  it('uses distinct badge styling for CLOSED status', () => {
    const router = routerWithDetail()
    const wrapper = mount(DeficiencyCard, {
      props: { deficiency: row({ status: 'CLOSED' }) },
      global: { plugins: [router] },
    })
    const st = wrapper.find('[data-testid="deficiency-card-status"]')
    expect(st.text()).toContain('Closed')
    expect(st.classes().some((c) => c.includes('emerald'))).toBe(true)
  })

  it('links to the deficiency detail route', async () => {
    const router = routerWithDetail()
    const wrapper = mount(DeficiencyCard, {
      props: { deficiency: row({ id: 'def-xyz', inspectionId: 'insp-abc' }) },
      global: { plugins: [router] },
    })
    const link = wrapper.find('[data-testid="deficiency-card-link-def-xyz"]')
    expect(link.attributes('href')).toContain('/inspections/insp-abc/deficiencies/def-xyz')
  })
})
