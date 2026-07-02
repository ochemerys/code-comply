import { describe, it, expect } from 'vitest'
import type { Deficiency } from '@codecomply/db'
import { DeficiencyMapper } from './deficiency.mapper.js'

describe('DeficiencyMapper', () => {
  it('maps entity to DTO with ISO dates', () => {
    const entity = {
      id: 'd1',
      clientId: 'c1',
      inspectionId: 'i1',
      checklistItemId: 'tmpl-item-42',
      description: 'Description text at least ten',
      location: 'North wall',
      severity: 'MAJOR',
      status: 'OPEN',
      codeReference: { code: 'NBC', section: '9.10.1', title: 'Fire' },
      isStopWork: false,
      isUnsafe: true,
      dueDate: new Date('2026-06-01T00:00:00.000Z'),
      createdAt: new Date('2026-01-01T10:00:00.000Z'),
      updatedAt: new Date('2026-01-01T11:00:00.000Z'),
    } as unknown as Deficiency

    const dto = DeficiencyMapper.toDTO(entity)
    expect(dto.id).toBe('d1')
    expect(dto.checklistItemId).toBe('tmpl-item-42')
    expect(dto.codeReference).toEqual({ code: 'NBC', section: '9.10.1', title: 'Fire' })
    expect(dto.dueDate).toBe('2026-06-01T00:00:00.000Z')
    expect(dto.createdAt).toBe('2026-01-01T10:00:00.000Z')
  })

  it('maps array via toDTOs', () => {
    const a = {
      id: 'a',
      clientId: 'c',
      inspectionId: 'i',
      description: 'Ten chars min',
      severity: 'MINOR',
      status: 'OPEN',
      isStopWork: false,
      isUnsafe: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as Deficiency
    expect(DeficiencyMapper.toDTOs([a])).toHaveLength(1)
  })
})
