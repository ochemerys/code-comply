import { describe, it, expect } from 'vitest'
import { VoCMapper } from './voc.mapper.js'

describe('VoCMapper', () => {
  it('maps VoC row to DTO', () => {
    const verificationDate = new Date('2026-11-02T10:00:00.000Z')
    const submittedAt = new Date('2026-11-02T12:00:00.000Z')

    expect(
      VoCMapper.toDTO({
        id: 'voc-1',
        deficiencyId: 'def-1',
        verificationDate,
        sectionTitle: 'Division B',
        title: 'Corrected',
        name: 'Owner',
        method: 'SITE_VISIT',
        comments: 'Verified',
        submittedAt,
        reviewedAt: null,
        reviewedById: null,
        status: 'PENDING',
      } as any),
    ).toEqual({
      id: 'voc-1',
      deficiencyId: 'def-1',
      verificationDate: verificationDate.toISOString(),
      sectionTitle: 'Division B',
      title: 'Corrected',
      name: 'Owner',
      method: 'SITE_VISIT',
      comments: 'Verified',
      submittedAt: submittedAt.toISOString(),
      reviewedAt: null,
      reviewedById: null,
      status: 'PENDING',
    })
  })

  it('maps multiple rows via toDTOs', () => {
    const rows = VoCMapper.toDTOs([
      {
        id: 'voc-1',
        deficiencyId: 'def-1',
        verificationDate: new Date('2026-11-02T10:00:00.000Z'),
        sectionTitle: 'A',
        title: 'B',
        name: 'C',
        method: 'OTHER',
        comments: null,
        submittedAt: new Date('2026-11-02T12:00:00.000Z'),
        reviewedAt: null,
        reviewedById: null,
        status: 'PENDING',
      },
    ] as any)

    expect(rows).toHaveLength(1)
    expect(rows[0].method).toBe('OTHER')
  })
})
