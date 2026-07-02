import { describe, it, expect } from 'vitest'
import { ChecklistTemplateDTOSchema, ChecklistExecutionDTOSchema } from '../../src/checklist.dto'

const iso = '2026-03-29T14:30:00.000Z'

/**
 * Integration-style parse of realistic template + execution payloads (multi-schema, shared IDs).
 */
describe('checklist DTO integration', () => {
  it('should parse template then execution referencing template metadata', () => {
    const templatePayload = {
      id: 'cm_template_1',
      name: 'Electrical rough-in',
      discipline: 'Electrical',
      version: 1,
      versionHash: 'sha256:e2e-template-001',
      items: [
        {
          id: 'item_gfci',
          order: 1,
          text: 'GFCI protection where required',
          category: 'Devices',
          isRequired: true,
          requiresPhoto: false,
        },
        {
          id: 'item_label',
          order: 2,
          text: 'Panel directory completed',
          isRequired: true,
        },
      ],
      isActive: true,
      createdAt: iso,
      updatedAt: iso,
    }

    const tpl = ChecklistTemplateDTOSchema.safeParse(templatePayload)
    expect(tpl.success).toBe(true)
    if (!tpl.success) return

    const executionPayload = {
      id: 'cm_exec_1',
      inspectionId: 'cm_insp_1',
      templateId: tpl.data.id,
      versionHash: tpl.data.versionHash,
      responses: [
        {
          itemId: 'item_gfci',
          result: 'PASS' as const,
          timestamp: iso,
        },
        {
          itemId: 'item_label',
          result: 'FAIL' as const,
          codeReference: { code: 'NBC', section: '9.10.1', title: 'Fire separation' },
          notes: 'Missing labels on 2 circuits',
          timestamp: iso,
        },
      ],
      progress: 100,
      completedAt: iso,
    }

    const exec = ChecklistExecutionDTOSchema.safeParse(executionPayload)
    expect(exec.success).toBe(true)
    if (exec.success) {
      expect(exec.data.versionHash).toBe(tpl.data.versionHash)
      expect(exec.data.responses).toHaveLength(2)
    }
  })
})
