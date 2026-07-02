import { describe, it, expect } from 'vitest'
import {
  TRIAGE_STOP_WORK_PERMIT_NUMBER,
  TRIAGE_TEST_PERMITS,
} from '../../prisma/seeds/triage-permits.seed.js'

describe('triage-permits seed (VC-INTAKE-02)', () => {
  it('defines expired, blank-LLD active, and Stop Work active permits', () => {
    const numbers = TRIAGE_TEST_PERMITS.map((p) => p.permitNumber)
    expect(numbers).toContain('EP-2025-000455')
    expect(numbers).toContain('BP-2026-004990')
    expect(numbers).toContain('BP-2026-003001')
  })

  it('marks EP-2025-000455 as EXPIRED', () => {
    const expired = TRIAGE_TEST_PERMITS.find((p) => p.permitNumber === 'EP-2025-000455')
    expect(expired?.status).toBe('EXPIRED')
  })

  it('marks BP-2026-004990 as ACTIVE with blank legal land description', () => {
    const blankLld = TRIAGE_TEST_PERMITS.find((p) => p.permitNumber === 'BP-2026-004990')
    expect(blankLld?.status).toBe('ACTIVE')
    expect(blankLld?.legalLandDesc).toBeNull()
  })

  it('identifies the Stop Work triage permit number', () => {
    expect(TRIAGE_STOP_WORK_PERMIT_NUMBER).toBe('BP-2026-003001')
    const stopWork = TRIAGE_TEST_PERMITS.find(
      (p) => p.permitNumber === TRIAGE_STOP_WORK_PERMIT_NUMBER,
    )
    expect(stopWork?.status).toBe('ACTIVE')
    expect(stopWork?.legalLandDesc).toBeTruthy()
  })
})
