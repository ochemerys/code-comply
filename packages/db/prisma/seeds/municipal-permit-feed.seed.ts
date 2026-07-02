import type { PermitStatus } from '@prisma/client'

export type MunicipalPermitFeedSeedRow = {
  permitNumber: string
  address: string
  legalLandDesc?: string | null
  scope: string
  status: PermitStatus
  latitude?: number | null
  longitude?: number | null
}

/** Permits present in the municipal feed but not yet in the agency catalog after seed. */
export const MUNICIPAL_ONLY_PERMITS: MunicipalPermitFeedSeedRow[] = []

/** Field-level updates in the municipal system since the agency last synced. */
export const MUNICIPAL_FEED_UPDATES: Record<string, Partial<MunicipalPermitFeedSeedRow>> = {
  'BP-2024-002': {
    address: '8882 170 Street NW, Edmonton, AB T5T 4J2 (Phase 2 renovation)',
    scope: 'Renovation - Kitchen, Bathroom, and Ensuite',
  },
}

export function buildMunicipalPermitFeed(
  agencyPermits: MunicipalPermitFeedSeedRow[],
): MunicipalPermitFeedSeedRow[] {
  const activeAgency = agencyPermits.filter((p) => p.status === 'ACTIVE')
  const fromAgency = activeAgency.map((permit) => ({
    ...permit,
    ...MUNICIPAL_FEED_UPDATES[permit.permitNumber],
  }))

  return [...fromAgency, ...MUNICIPAL_ONLY_PERMITS]
}

export function agencyPermitsForSeed(
  allPermits: MunicipalPermitFeedSeedRow[],
): MunicipalPermitFeedSeedRow[] {
  const municipalOnlyNumbers = new Set(MUNICIPAL_ONLY_PERMITS.map((p) => p.permitNumber))
  return allPermits.filter((p) => !municipalOnlyNumbers.has(p.permitNumber))
}
