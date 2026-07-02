import type { PermitStatus } from '@prisma/client'

export type TriagePermitSeedRow = {
  permitNumber: string
  address: string
  legalLandDesc?: string | null
  scope: string
  status: PermitStatus
  latitude?: number | null
  longitude?: number | null
}

/** VC-INTAKE-02 — permits for admin triage verification (expired, blank LLD, Stop Work). */
export const TRIAGE_TEST_PERMITS: TriagePermitSeedRow[] = [
  {
    permitNumber: 'EP-2025-000455',
    address: 'Lot 12, Township Road 512, Leduc County, AB',
    legalLandDesc: 'NW-12-49-25-W4',
    scope: 'Electrical — Service upgrade (expired)',
    status: 'EXPIRED',
    latitude: 53.2594,
    longitude: -113.5497,
  },
  {
    permitNumber: 'BP-2026-004990',
    address: 'Rural — Legal land description pending confirmation',
    legalLandDesc: null,
    scope: 'New Construction - Rural single family dwelling',
    status: 'ACTIVE',
    latitude: 53.6123,
    longitude: -113.7234,
  },
  {
    permitNumber: 'BP-2026-003001',
    address: '7018 Ada Boulevard NW, Edmonton, AB T5W 4J8',
    legalLandDesc: 'Plan 8821XY Block 4 Lot 9',
    scope: 'Addition - Second storey',
    status: 'ACTIVE',
    latitude: 53.5789,
    longitude: -113.4567,
  },
]

export const TRIAGE_STOP_WORK_PERMIT_NUMBER = 'BP-2026-003001'
