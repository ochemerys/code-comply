/**
 * Unit tests for PermitDetails component (M4-S11)
 * Renders permit information and location sections.
 */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PermitDetails from './PermitDetails.vue'
import type { PermitDTO } from '@codecomply/validators'

const permit: PermitDTO = {
  id: 'p1',
  permitNumber: 'BP-2024-001',
  address: '123 Main St, Calgary AB',
  legalLandDesc: 'SW-1-2-3 W4',
  scope: 'Building',
  status: 'ACTIVE',
  latitude: 51.04,
  longitude: -114.06,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-15T00:00:00.000Z',
}

describe('PermitDetails', () => {
  it('renders permit information section', () => {
    const wrapper = mount(PermitDetails, { props: { permit } })
    expect(wrapper.text()).toContain('Permit Information')
    expect(wrapper.text()).toContain('BP-2024-001')
    expect(wrapper.text()).toContain('123 Main St, Calgary AB')
    expect(wrapper.text()).toContain('Building')
    expect(wrapper.text()).toContain('ACTIVE')
    expect(wrapper.text()).toContain('Legal land description')
    expect(wrapper.text()).toContain('SW-1-2-3 W4')
  })

  it('renders location details with GPS coordinates', () => {
    const wrapper = mount(PermitDetails, { props: { permit } })
    expect(wrapper.text()).toContain('Location Details')
    expect(wrapper.text()).toContain('51.040000')
    expect(wrapper.text()).toContain('-114.060000')
  })

  it('shows em dash for missing optional fields', () => {
    const minimalPermit: PermitDTO = {
      ...permit,
      legalLandDesc: undefined,
      latitude: undefined,
      longitude: undefined,
    }
    const wrapper = mount(PermitDetails, { props: { permit: minimalPermit } })
    expect(wrapper.text()).toContain('—')
  })

  it('renders inspection stage when present on permit or inspections', () => {
    const permitWithStage: PermitDTO = {
      ...permit,
      inspectionStageLabel: 'Foundation',
      inspections: [
        {
          id: 'insp-1',
          status: 'SCHEDULED',
          scheduledDate: '2026-06-10T12:00:00.000Z',
          stages: ['FOUNDATION'],
        },
      ],
    }
    const wrapper = mount(PermitDetails, { props: { permit: permitWithStage } })
    expect(wrapper.get('[data-testid="permit-detail-stage"]').text()).toBe('Foundation')
  })
})
