/** VC-APPROVE-* — reporting & compliance approval cross-app verification seed data. */

export const APPROVE_VERIFICATION_PERMIT = {
  permitNumber: 'BP-2026-004821',
  /** FOIP search LLD from VC-APPROVE-05 test_data */
  legalLandDesc: 'Plan 1620P, Block 5, Lot 22',
  finalizedAt: '2026-06-07T18:00:00.000Z',
  completedDate: '2026-06-07T18:00:00.000Z',
} as const

export const APPROVE_GARAGE_DEFICIENCY = {
  description: 'Garage fire separation drywall missing',
  location: 'Attached garage, east wall',
  severity: 'MINOR' as const,
  relatedOrderNumber: 'ORD-2026-000337',
} as const

export const APPROVE_VOC_SUBMITTED = {
  verificationDate: '2026-06-16T12:00:00.000Z',
  method: 'SITE_VISIT' as const,
  submitter: 'Pat Nguyen',
  comments: 'Type X drywall installed and taped; verified on re-inspection',
} as const
