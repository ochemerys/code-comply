/** VC-FIELD-* — inspector sync, search, and geofence verification seed data. */

export const FIELD_SYNC_SCO = {
  email: 'pat.nguyen@example.com',
  password: 'password123',
} as const

/** Primary cross-app handoff permit (VC-FIELD-02 / VC-ASSIGN-02). */
export const FIELD_ASSIGNED_PERMIT = {
  permitNumber: 'BP-2026-004821',
  address: '118 Aspen Ridge Way SW, Calgary, AB',
  legalLandDesc: 'Plan 4821AB Block 1 Lot 7',
  scope: 'New Construction - Single Family Dwelling',
  latitude: 51.0447,
  longitude: -114.0719,
  scheduledDate: '2026-06-10T10:00:00.000Z',
  stage: 'FOUNDATION' as const,
  notes: 'Foundation inspection — assigned to Pat Nguyen (VC-FIELD-02)',
} as const
