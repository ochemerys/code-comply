import { describe, it, expect } from 'vitest'
import {
  CreateDeficiencyDTOSchema,
  DeficiencyDTOSchema,
  UpdateDeficiencyDTOSchema,
} from '../../src/deficiency.dto'

const iso = '2026-04-03T10:00:00.000Z'

/**
 * Multi-schema flow: create payload → simulated API row → patch update.
 */
describe('deficiency DTO integration', () => {
  it('should parse create then map to full DTO shape and apply update patch', () => {
    const created = CreateDeficiencyDTOSchema.safeParse({
      clientId: 'offline-client-uuid',
      inspectionId: 'cm_insp_def_1',
      checklistItemId: 'chk_item_gfci',
      description: 'GFCI protection missing where the code requires it installed.',
      location: 'Bath 2',
      severity: 'MAJOR',
      codeReference: { code: 'NBC', section: '26-722', title: 'GFCI' },
      dueDate: '2026-09-01T00:00:00.000Z',
    })
    expect(created.success).toBe(true)
    if (!created.success) return

    const row = {
      id: 'cm_def_1',
      clientId: created.data.clientId,
      inspectionId: created.data.inspectionId,
      checklistItemId: created.data.checklistItemId,
      description: created.data.description,
      location: created.data.location,
      severity: created.data.severity,
      status: 'OPEN' as const,
      codeReference: created.data.codeReference,
      isStopWork: created.data.isStopWork,
      isUnsafe: created.data.isUnsafe,
      dueDate: created.data.dueDate,
      createdAt: iso,
      updatedAt: iso,
    }

    const full = DeficiencyDTOSchema.safeParse(row)
    expect(full.success).toBe(true)

    const patch = UpdateDeficiencyDTOSchema.safeParse({
      description: 'Updated narrative after supervisor review on site today.',
      severity: 'CRITICAL',
      isStopWork: true,
      status: 'CLOSED',
    })
    expect(patch.success).toBe(true)
    if (patch.success) {
      expect(patch.data).not.toHaveProperty('clientId')
    }
  })
})
