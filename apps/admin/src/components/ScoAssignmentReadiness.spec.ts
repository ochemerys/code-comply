import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ScoAssignmentReadiness from './ScoAssignmentReadiness.vue'
import type { UserDTO } from '@codecomply/validators'

const iso = () => new Date().toISOString()

function makeUser(overrides: Partial<UserDTO> = {}): UserDTO {
  return {
    id: 'u1',
    email: 'pat@example.com',
    name: 'Pat Nguyen',
    role: 'SCO',
    disciplines: ['Building'],
    isActive: true,
    certificationExpiry: '2027-03-31T00:00:00.000Z',
    certifications: [],
    createdAt: iso(),
    updatedAt: iso(),
    ...overrides,
  }
}

describe('ScoAssignmentReadiness', () => {
  it('shows eligible when certification covers the planned date', () => {
    const wrapper = mount(ScoAssignmentReadiness, {
      props: {
        user: makeUser(),
        plannedDate: '2026-06-10',
      },
    })

    expect(wrapper.get('[data-testid="user-detail-certification-eligibility"]').text()).toMatch(
      /eligible/i,
    )
  })

  it('flags ineligible when certification expires before the planned date', () => {
    const wrapper = mount(ScoAssignmentReadiness, {
      props: {
        user: makeUser({ certificationExpiry: '2026-03-31T00:00:00.000Z' }),
        plannedDate: '2026-06-10',
      },
    })

    expect(wrapper.get('[data-testid="user-detail-certification-eligibility"]').text()).toMatch(
      /ineligible/i,
    )
    expect(wrapper.get('[data-testid="user-detail-readiness-guidance"]').text()).toMatch(
      /before the planned inspection/i,
    )
  })
})
