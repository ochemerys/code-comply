import { describe, it, expect } from 'vitest'
import { ESCALATION_UNABLE_TO_ENTER_PERMIT } from '../../prisma/seeds/escalation-verification.seed.js'

describe('escalation-verification.seed', () => {
  it('defines BP-2026-004990 scheduled inspection for unable-to-enter verification', () => {
    expect(ESCALATION_UNABLE_TO_ENTER_PERMIT.permitNumber).toBe('BP-2026-004990')
    expect(ESCALATION_UNABLE_TO_ENTER_PERMIT.stage).toBe('FOUNDATION')
    expect(ESCALATION_UNABLE_TO_ENTER_PERMIT.scheduledDate).toMatch(/^2026-/)
  })
})
