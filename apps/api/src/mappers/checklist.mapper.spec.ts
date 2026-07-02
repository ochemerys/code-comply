import { describe, it, expect } from 'vitest'
import { ChecklistMapper } from './checklist.mapper'
import type { ChecklistExecution, ChecklistTemplate } from '@codecomply/db'

describe('ChecklistMapper', () => {
  const baseTemplate = {
    id: 'tpl-1',
    name: 'Test',
    discipline: 'Building',
    version: 1,
    versionHash: 'vh-1',
    isActive: true,
    createdAt: new Date('2026-01-01T10:00:00.000Z'),
    updatedAt: new Date('2026-01-02T10:00:00.000Z'),
  } satisfies Partial<ChecklistTemplate>

  it('maps template items using text or legacy label', () => {
    const entity = {
      ...baseTemplate,
      items: [
        { id: 'a', order: 1, text: 'First' },
        { id: 'b', order: 2, label: 'Second' },
      ],
    } as ChecklistTemplate

    const dto = ChecklistMapper.toTemplateDTO(entity)
    expect(dto.items[0].text).toBe('First')
    expect(dto.items[1].text).toBe('Second')
    expect(dto.createdAt).toBe('2026-01-01T10:00:00.000Z')
  })

  it('maps template items with optional codeReferences on items', () => {
    const entity = {
      ...baseTemplate,
      items: [
        {
          id: 'x',
          order: 1,
          text: 'T',
          codeReferences: [{ code: 'NBC', section: '1.1.1', title: 'Ref' }],
        },
      ],
    } as ChecklistTemplate

    const dto = ChecklistMapper.toTemplateDTO(entity)
    expect(dto.items[0].codeReferences?.[0]?.section).toBe('1.1.1')
  })

  it('maps serialized template date values', () => {
    const entity = {
      ...baseTemplate,
      createdAt: '2026-01-01T10:00:00.000Z',
      updatedAt: '2026-01-02T10:00:00.000Z',
      items: [],
    } as unknown as ChecklistTemplate

    const dto = ChecklistMapper.toTemplateDTO(entity)

    expect(dto.createdAt).toBe('2026-01-01T10:00:00.000Z')
    expect(dto.updatedAt).toBe('2026-01-02T10:00:00.000Z')
  })

  it('maps execution with responses and completedAt', () => {
    const template = {
      ...baseTemplate,
      items: [{ id: 'i1', order: 1, text: 'Q' }],
    } as ChecklistTemplate

    const execution = {
      id: 'ex-1',
      inspectionId: 'in-1',
      templateId: 'tpl-1',
      versionHash: 'vh-1',
      responses: [
        {
          itemId: 'i1',
          result: 'PASS',
          timestamp: '2026-03-01T12:00:00.000Z',
        },
      ],
      progress: 100,
      completedAt: new Date('2026-03-01T12:05:00.000Z'),
      template,
    } as ChecklistExecution & { template: ChecklistTemplate }

    const dto = ChecklistMapper.toExecutionDTO(execution)
    expect(dto.progress).toBe(100)
    expect(dto.responses).toHaveLength(1)
    expect(dto.responses[0].itemId).toBe('i1')
    expect(dto.completedAt).toBe('2026-03-01T12:05:00.000Z')
  })
})
