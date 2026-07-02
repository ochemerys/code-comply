import { z } from 'zod'

/** Standard Alberta safety codes inspection disciplines (LSC-A-02). */
export const KNOWN_DISCIPLINES = ['Building', 'Electrical', 'Gas', 'Plumbing'] as const

export type KnownDiscipline = (typeof KNOWN_DISCIPLINES)[number]

export const DEFAULT_MAX_ASSIGNMENTS_PER_DAY = 5

export const ScoCertificationReadinessSchema = z.object({
  plannedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  eligible: z.boolean(),
  effectiveExpiry: z.string().datetime().nullable(),
  guidance: z.array(z.string()),
})

export type ScoCertificationReadiness = z.infer<typeof ScoCertificationReadinessSchema>

export const ScoDisciplineMatchSchema = z.object({
  permitDiscipline: z.string().nullable(),
  eligible: z.boolean(),
  guidance: z.array(z.string()),
})

export type ScoDisciplineMatch = z.infer<typeof ScoDisciplineMatchSchema>

export const ScoDailyAvailabilitySchema = z.object({
  count: z.number().int().nonnegative(),
  maxPerDay: z.number().int().positive(),
  atCapacity: z.boolean(),
  overCapacity: z.boolean(),
  guidance: z.array(z.string()),
})

export type ScoDailyAvailability = z.infer<typeof ScoDailyAvailabilitySchema>

export type CertificationEligibilityInput = {
  certificationExpiry?: string | null
  certifications?: Array<{ expiryDate?: string | null; status: string }>
  isActive?: boolean
}

function startOfUtcDayFromIso(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`)
}

/** Infer permit discipline from scope text (e.g. "Electrical - Service Upgrade" → Electrical). */
export function inferDisciplineFromScope(scope: string): string | null {
  const normalized = scope.trim()
  if (!normalized) return null

  for (const discipline of KNOWN_DISCIPLINES) {
    if (normalized.toLowerCase().startsWith(discipline.toLowerCase())) {
      return discipline
    }
  }

  return null
}

function resolveEffectiveCertExpiry(user: CertificationEligibilityInput): Date | null {
  const candidates: Date[] = []

  if (user.certificationExpiry) {
    candidates.push(new Date(user.certificationExpiry))
  }

  for (const cert of user.certifications ?? []) {
    if (cert.status === 'REVOKED' || cert.status === 'EXPIRED') continue
    if (cert.expiryDate) {
      candidates.push(new Date(cert.expiryDate))
    }
  }

  if (candidates.length === 0) return null
  return candidates.reduce((latest, d) => (d.getTime() > latest.getTime() ? d : latest))
}

/**
 * Whether the SCO's certification covers the planned inspection UTC calendar day (A-01).
 * Certification must be valid on or after the planned date (expiry on the planned day is OK).
 */
export function computeCertificationEligibility(
  user: CertificationEligibilityInput,
  plannedDateIso: string,
): ScoCertificationReadiness {
  const guidance: string[] = []
  const planned = startOfUtcDayFromIso(plannedDateIso)

  if (user.isActive === false) {
    guidance.push('Inactive accounts cannot receive assignments.')
    return {
      plannedDate: plannedDateIso,
      eligible: false,
      effectiveExpiry: null,
      guidance,
    }
  }

  const effectiveExpiry = resolveEffectiveCertExpiry(user)
  if (!effectiveExpiry) {
    guidance.push('No valid certification expiry on file — confirm before assigning.')
    return {
      plannedDate: plannedDateIso,
      eligible: false,
      effectiveExpiry: null,
      guidance,
    }
  }

  const eligible = effectiveExpiry.getTime() >= planned.getTime()
  if (eligible) {
    guidance.push(
      `Certification valid through ${effectiveExpiry.toISOString().slice(0, 10)} — eligible for ${plannedDateIso}.`,
    )
  } else {
    guidance.push(
      `Certification expires ${effectiveExpiry.toISOString().slice(0, 10)} before the planned inspection on ${plannedDateIso}.`,
    )
  }

  return {
    plannedDate: plannedDateIso,
    eligible,
    effectiveExpiry: effectiveExpiry.toISOString(),
    guidance,
  }
}

/** Whether SCO disciplines include the permit discipline (A-01). */
export function computeDisciplineMatch(
  scoDisciplines: string[],
  permitDiscipline: string | null,
): ScoDisciplineMatch {
  const guidance: string[] = []

  if (!permitDiscipline) {
    guidance.push('Permit discipline could not be determined from scope — verify manually.')
    return { permitDiscipline: null, eligible: true, guidance }
  }

  const normalizedSco = scoDisciplines.map((d) => d.trim().toLowerCase())
  const eligible = normalizedSco.includes(permitDiscipline.toLowerCase())

  if (eligible) {
    guidance.push(`SCO holds ${permitDiscipline} designation — discipline match.`)
  } else {
    const listed = scoDisciplines.length ? scoDisciplines.join(', ') : 'none'
    guidance.push(
      `Discipline mismatch: permit requires ${permitDiscipline}; SCO disciplines are ${listed}.`,
    )
  }

  return { permitDiscipline, eligible, guidance }
}

/** Daily assignment load relative to the default maximum (A-02). */
export function computeDailyAvailability(
  count: number,
  maxPerDay = DEFAULT_MAX_ASSIGNMENTS_PER_DAY,
): ScoDailyAvailability {
  const atCapacity = count >= maxPerDay
  const overCapacity = count > maxPerDay
  const guidance: string[] = []

  if (overCapacity) {
    guidance.push(
      `${count} assignments on this UTC day — over the default maximum of ${maxPerDay}. Rebalance before adding more.`,
    )
  } else if (atCapacity) {
    guidance.push(
      `${count} of ${maxPerDay} default daily assignments — at capacity; further assignments need manager review.`,
    )
  } else if (count === maxPerDay - 1) {
    guidance.push(
      `${count} of ${maxPerDay} default daily assignments — one slot remaining on this UTC day.`,
    )
  }

  return { count, maxPerDay, atCapacity, overCapacity, guidance }
}
