/**
 * Unit tests for PermitCard component (M4-S10)
 * Renders permit number, address, status badge, next inspection date, distance.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import PermitCard from './PermitCard.vue'
import type { PermitListDTO } from '@codecomply/validators'

const permit: PermitListDTO = {
  id: 'p1',
  permitNumber: 'BP-2024-001',
  address: '123 Main St, Calgary AB',
  status: 'ACTIVE',
  nextInspectionDate: '2024-06-15T00:00:00.000Z',
  distance: 1500,
}

describe('PermitCard', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders permit number and address', () => {
    const wrapper = mount(PermitCard, {
      props: { permit },
      global: { plugins: [createPinia()] },
    })
    expect(wrapper.text()).toContain('BP-2024-001')
    expect(wrapper.text()).toContain('123 Main St, Calgary AB')
  })

  it('renders status badge', () => {
    const wrapper = mount(PermitCard, {
      props: { permit },
      global: { plugins: [createPinia()] },
    })
    expect(wrapper.text()).toContain('ACTIVE')
  })

  it('renders next inspection date', () => {
    const wrapper = mount(PermitCard, {
      props: { permit },
      global: { plugins: [createPinia()] },
    })
    expect(wrapper.text()).toMatch(/Next inspection/)
    expect(wrapper.text()).toContain('Jun') // locale date
  })

  it('renders distance when present', () => {
    const wrapper = mount(PermitCard, {
      props: { permit },
      global: { plugins: [createPinia()] },
    })
    expect(wrapper.text()).toContain('1.5 km')
  })

  it('does not render distance when not present', () => {
    const p = { ...permit, distance: undefined }
    const wrapper = mount(PermitCard, {
      props: { permit: p },
      global: { plugins: [createPinia()] },
    })
    expect(wrapper.text()).not.toContain('km')
    expect(wrapper.text()).not.toContain(' m')
  })

  it('emits click with permit when card is clicked', async () => {
    const wrapper = mount(PermitCard, {
      props: { permit },
      global: { plugins: [createPinia()] },
    })
    await wrapper.find('.permit-card [role="button"]').trigger('click')
    const emitted = wrapper.emitted('click')
    expect(emitted).toBeDefined()
    expect(emitted!).toHaveLength(1)
    expect(emitted![0]).toEqual([permit])
  })

  it('shows orphan warning when isOrphan is true', () => {
    const wrapper = mount(PermitCard, {
      props: { permit: { ...permit, isOrphan: true } },
      global: { plugins: [createPinia()] },
    })
    expect(wrapper.text()).toContain('Not found on server')
  })

  it('shows Remove from device when orphan and showOrphanDelete', () => {
    const wrapper = mount(PermitCard, {
      props: { permit: { ...permit, isOrphan: true }, showOrphanDelete: true },
      global: { plugins: [createPinia()] },
    })
    expect(wrapper.find('[data-testid="permit-card-remove-orphan"]').exists()).toBe(true)
  })

  it('does not show Remove from device without showOrphanDelete', () => {
    const wrapper = mount(PermitCard, {
      props: { permit: { ...permit, isOrphan: true }, showOrphanDelete: false },
      global: { plugins: [createPinia()] },
    })
    expect(wrapper.find('[data-testid="permit-card-remove-orphan"]').exists()).toBe(false)
  })

  it('handles missing nextInspectionDate', () => {
    const p = { ...permit, nextInspectionDate: undefined }
    const wrapper = mount(PermitCard, {
      props: { permit: p },
      global: { plugins: [createPinia()] },
    })
    expect(wrapper.text()).toMatch(/Next inspection/)
    expect(wrapper.text()).toContain('—')
  })
})
