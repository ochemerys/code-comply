/** VC-ASSIGN-* — users, permits, and inspections for assignment verification. */

export const ASSIGNMENT_VERIFICATION_SCO = {
  email: 'pat.nguyen@example.com',
  name: 'Pat Nguyen',
  designationId: 'SCO-PN-001',
  disciplines: ['Building'],
  authorities: ['Alberta Municipal Affairs'],
  certificationExpiry: '2027-03-31T00:00:00.000Z',
  password: 'password123',
} as const

export const ASSIGNMENT_INACTIVE_SCO = {
  email: 'jordan.blake@example.com',
  name: 'Jordan Blake',
  designationId: 'SCO-JB-099',
  disciplines: ['Building'],
  authorities: ['Alberta Municipal Affairs'],
  password: 'password123',
} as const

export const ASSIGNMENT_PREPARED_PERMIT = {
  permitNumber: 'BP-2026-004821',
  scheduledDate: '2026-06-10T10:00:00.000Z',
  notes: 'New dwelling framing — needs assignment (VC-ASSIGN-02)',
} as const

export const ASSIGNMENT_SUBDIVISION_PERMITS = [
  {
    permitNumber: 'BP-2026-005010',
    address: '1010 Subdivision Drive, Edmonton, AB',
    legalLandDesc: 'Plan 5010AB Block 1 Lot 1',
    scope: 'New Construction - Subdivision lot 1',
    notes: 'Subdivision framing — bulk assign smoke (VC-ASSIGN-03)',
  },
  {
    permitNumber: 'BP-2026-005011',
    address: '1011 Subdivision Drive, Edmonton, AB',
    legalLandDesc: 'Plan 5010AB Block 1 Lot 2',
    scope: 'New Construction - Subdivision lot 2',
    notes: 'Subdivision framing — bulk assign smoke (VC-ASSIGN-03)',
  },
  {
    permitNumber: 'BP-2026-005012',
    address: '1012 Subdivision Drive, Edmonton, AB',
    legalLandDesc: 'Plan 5010AB Block 1 Lot 3',
    scope: 'New Construction - Subdivision lot 3',
    notes: 'Subdivision framing — bulk assign smoke (VC-ASSIGN-03)',
  },
] as const

/** Near-max workload day for Pat Nguyen (4 of 5 default max on 2026-06-10). */
export const ASSIGNMENT_NEAR_MAX_DATE = '2026-06-10T12:00:00.000Z'

export const ASSIGNMENT_NEAR_MAX_PERMIT_NUMBERS = [
  'BP-2024-001',
  'BP-2024-003',
  'BP-2024-006',
  'BP-2024-NS-002',
] as const
