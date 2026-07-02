import { describe, it, expect, beforeEach, vi } from 'vitest'
import { testClient } from 'hono/testing'
import { Hono } from 'hono'
import type { User } from '@codecomply/db'
import type { AssignmentDTO, WorkloadDTO } from '@codecomply/validators'
import assignmentsApp from './assignments'
import { assignmentService } from '../../services/assignment.service'
import { AssignmentMapper } from '../../mappers/assignment.mapper'
import { roleMiddleware } from '../../middleware/auth.middleware'

vi.mock('../../services/assignment.service')
vi.mock('../../mappers/assignment.mapper')

/** `testClient()` is typed as `unknown`; narrow to the routes this spec exercises. */
type AdminAssignmentsTestClient = {
  index: {
    $post: (opts: { json: { inspectionId: string; userId: string } }) => Promise<Response>
  }
  bulk: {
    $post: (opts: {
      json: { items: Array<{ inspectionId: string; userId: string }> }
    }) => Promise<Response>
  }
  workload: {
    $get: (opts: { query: { userId: string; from: string; to: string } }) => Promise<Response>
  }
}

const createAdminTestApp = () => {
  const testApp = new Hono()
  testApp.use('*', async (c, next) => {
    c.set('user', { id: 'admin-1', role: 'ADMIN' } as User)
    c.set('userId', 'admin-1')
    await next()
  })
  testApp.use('*', roleMiddleware(['ADMIN']))
  testApp.route('/', assignmentsApp)
  return testApp
}

async function jsonBody<T>(res: Response): Promise<T> {
  return (await res.json()) as T
}

const adminAssignmentsClient = () => testClient(createAdminTestApp()) as AdminAssignmentsTestClient

describe('Admin assignments routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('POST / assigns and returns DTO', async () => {
    const row = { id: 's1' } as any
    const dto = { id: 's1', inspectionId: 'i1', assignedToId: 'u1' } as any
    vi.mocked(assignmentService.assign).mockResolvedValue(row)
    vi.mocked(AssignmentMapper.toDTO).mockReturnValue(dto)

    const res = await adminAssignmentsClient().index.$post({
      json: { inspectionId: 'i1', userId: 'u1' },
    })
    expect(res.status).toBe(200)
    expect(await jsonBody<AssignmentDTO>(res)).toEqual(dto as AssignmentDTO)
    expect(assignmentService.assign).toHaveBeenCalledWith('i1', 'u1', { scheduledDate: undefined })
  })

  it('GET /grid returns grid payload', async () => {
    vi.mocked(assignmentService.getGridData).mockResolvedValue({
      inspectors: [{ id: 'u1', name: 'Alex' }],
      unassigned: [],
      assignments: [],
    })

    const client = testClient(createAdminTestApp()) as {
      grid: { $get: (opts: { query: { from: string; to: string } }) => Promise<Response> }
    }
    const res = await client.grid.$get({ query: { from: '2026-05-01', to: '2026-05-07' } })
    expect(res.status).toBe(200)
    const body = await jsonBody<{ inspectors: { id: string }[] }>(res)
    expect(body.inspectors).toHaveLength(1)
  })

  it('POST / returns 404 when inspection missing', async () => {
    vi.mocked(assignmentService.assign).mockRejectedValue(new Error('Inspection not found'))
    const res = await adminAssignmentsClient().index.$post({
      json: { inspectionId: 'i1', userId: 'u1' },
    })
    expect(res.status).toBe(404)
  })

  it('POST /bulk returns DTOs', async () => {
    const rows = [{ id: 's1' }] as any[]
    const dtos = [{ id: 's1' }] as any[]
    vi.mocked(assignmentService.bulkAssign).mockResolvedValue(rows)
    vi.mocked(AssignmentMapper.toDTOs).mockReturnValue(dtos)

    const res = await adminAssignmentsClient().bulk.$post({
      json: { items: [{ inspectionId: 'i1', userId: 'u1' }] },
    })
    expect(res.status).toBe(200)
    expect(await jsonBody<AssignmentDTO[]>(res)).toEqual(dtos as AssignmentDTO[])
  })

  it('GET /workload returns serialized workload', async () => {
    const d = new Date('2026-05-01T00:00:00.000Z')
    vi.mocked(assignmentService.getWorkload).mockResolvedValue({
      userId: 'u1',
      scheduledCount: 1,
      inspections: [{ inspectionId: 'i1', scheduledDate: d, status: 'SCHEDULED' }],
    })

    const res = await adminAssignmentsClient().workload.$get({
      query: {
        userId: 'u1',
        from: '2026-05-01T00:00:00.000Z',
        to: '2026-05-02T00:00:00.000Z',
      },
    })
    expect(res.status).toBe(200)
    const body = await jsonBody<WorkloadDTO>(res)
    expect(body.userId).toBe('u1')
    expect(body.scheduledCount).toBe(1)
    expect(body.inspections[0].inspectionId).toBe('i1')
    expect(body.inspections[0].status).toBe('SCHEDULED')
  })
})
