import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { DeficiencyDTO, InspectionListDTO } from '@codecomply/validators'
import {
  applyClientDeficiencyFilters,
  deficiencyStatusLabel,
  fetchAdminDeficiencies,
  createAdminDeficiency,
  deleteAdminDeficiency,
  newDeficiencyClientId,
} from './useAdminDeficiencies'

vi.mock('@/api/client', () => ({
  api: {
    deficiencies: {
      $get: vi.fn(),
      $post: vi.fn(),
      ':id': {
        $delete: vi.fn(),
      },
    },
    admin: {
      'code-library': {
        $get: vi.fn(),
      },
    },
  },
}))

import { api } from '@/api/client'

const sampleDeficiency = (overrides: Partial<DeficiencyDTO> = {}): DeficiencyDTO => ({
  id: 'def-1',
  clientId: 'client-1',
  inspectionId: 'insp-1',
  description: 'Missing fire separation detail',
  severity: 'MAJOR',
  status: 'OPEN',
  isStopWork: false,
  isUnsafe: false,
  dueDate: '2025-06-01T00:00:00.000Z',
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
  ...overrides,
})

describe('useAdminDeficiencies helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('deficiencyStatusLabel maps lifecycle states', () => {
    expect(deficiencyStatusLabel('OPEN')).toBe('Open')
    expect(deficiencyStatusLabel('CLOSED')).toBe('Resolved')
    expect(deficiencyStatusLabel('VOC_SUBMITTED')).toBe('VoC pending review')
  })

  it('newDeficiencyClientId returns a UUID string', () => {
    const id = newDeficiencyClientId()
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
  })

  it('applyClientDeficiencyFilters filters by permit and due date', () => {
    const rows = [
      sampleDeficiency({ id: 'd1', inspectionId: 'insp-1' }),
      sampleDeficiency({
        id: 'd2',
        inspectionId: 'insp-2',
        dueDate: '2025-07-01T00:00:00.000Z',
      }),
    ]
    const inspections = new Map<string, InspectionListDTO>([
      [
        'insp-1',
        {
          id: 'insp-1',
          permitNumber: 'P-100',
          address: '1 Main',
          status: 'IN_PROGRESS',
          scheduledDate: '2025-01-01T00:00:00.000Z',
        } as InspectionListDTO,
      ],
      [
        'insp-2',
        {
          id: 'insp-2',
          permitNumber: 'P-200',
          address: '2 Main',
          status: 'IN_PROGRESS',
          scheduledDate: '2025-01-01T00:00:00.000Z',
        } as InspectionListDTO,
      ],
    ])

    const filtered = applyClientDeficiencyFilters(
      rows,
      {
        inspectionId: '',
        status: '',
        severity: '',
        permitNumber: 'P-100',
        dueDateFrom: '',
        dueDateTo: '2025-06-15',
      },
      inspections,
    )

    expect(filtered.map((d) => d.id)).toEqual(['d1'])
  })

  it('fetchAdminDeficiencies calls API with query filters', async () => {
    const dto = sampleDeficiency()
    vi.mocked(api.deficiencies.$get).mockResolvedValue(
      new Response(JSON.stringify([dto]), { status: 200 }) as Awaited<
        ReturnType<typeof api.deficiencies.$get>
      >,
    )

    const result = await fetchAdminDeficiencies({
      inspectionId: 'insp-1',
      status: 'OPEN',
    })
    expect(result).toEqual([dto])
    expect(api.deficiencies.$get).toHaveBeenCalledWith({
      query: { inspectionId: 'insp-1', status: 'OPEN', severity: undefined },
    })
  })

  it('createAdminDeficiency posts body', async () => {
    const dto = sampleDeficiency()
    vi.mocked(api.deficiencies.$post).mockResolvedValue(
      new Response(JSON.stringify(dto), { status: 201 }) as Awaited<
        ReturnType<typeof api.deficiencies.$post>
      >,
    )

    const body = {
      clientId: newDeficiencyClientId(),
      inspectionId: 'insp-1',
      description: 'Wall assembly not compliant with NBC',
      severity: 'MAJOR' as const,
      isStopWork: false,
      isUnsafe: false,
    }
    const created = await createAdminDeficiency(body)
    expect(created.id).toBe('def-1')
    expect(api.deficiencies.$post).toHaveBeenCalledWith({ json: body })
  })

  it('deleteAdminDeficiency calls delete endpoint', async () => {
    vi.mocked(api.deficiencies[':id'].$delete).mockResolvedValue(
      new Response(null, { status: 204 }) as Awaited<
        ReturnType<(typeof api.deficiencies)[':id']['$delete']>
      >,
    )

    await deleteAdminDeficiency('def-1')
    expect(api.deficiencies[':id'].$delete).toHaveBeenCalledWith({ param: { id: 'def-1' } })
  })
})
