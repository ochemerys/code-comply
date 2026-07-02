import { describe, it, expect, beforeEach, vi } from 'vitest'
import { testClient } from 'hono/testing'
import { Hono } from 'hono'
import type { User } from '@codecomply/db'
import inspectionsApp from './inspections'
import { adminInspectionRecordService } from '../../services/admin-inspection-record.service.js'
import { inspectionCertificationSnapshotService } from '../../services/inspection-certification-snapshot.service.js'
import { inspectionService } from '../../services/inspection.service.js'
import { inspectionWorkflowService } from '../../services/inspection-workflow.service.js'

vi.mock('../../services/admin-inspection-record.service')
vi.mock('../../services/inspection-certification-snapshot.service')
vi.mock('../../services/inspection.service')
vi.mock('../../services/inspection-workflow.service')

const createAdminTestApp = () => {
  const testApp = new Hono()
  testApp.use('*', async (c, next) => {
    c.set('user', { id: 'admin-1', role: 'ADMIN' } as User)
    c.set('userId', 'admin-1')
    await next()
  })
  testApp.route('/', inspectionsApp)
  return testApp
}

type InspectionsTestClient = {
  ':id': {
    workflow: {
      $get: (opts: { param: { id: string } }) => Promise<Response>
      $patch: (opts: { param: { id: string }; json: object }) => Promise<Response>
    }
    record: { $get: (opts: { param: { id: string } }) => Promise<Response> }
    addendum: {
      $post: (opts: { param: { id: string }; json: object }) => Promise<Response>
    }
    addendums: {
      ':addendumId': {
        $get: (opts: { param: { id: string; addendumId: string } }) => Promise<Response>
      }
    }
    'certification-snapshot': { $get: (opts: { param: { id: string } }) => Promise<Response> }
  }
}

const client = () => testClient(createAdminTestApp()) as InspectionsTestClient

describe('Admin inspections routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('GET /:id/record returns record detail', async () => {
    vi.mocked(adminInspectionRecordService.getRecordDetail).mockResolvedValue({
      inspectionId: 'insp-1',
      permitNumber: 'P-001',
      address: '123 Main',
      status: 'PASSED',
      scheduledDate: '2024-01-15T10:00:00.000Z',
      isFinalized: true,
      finalizedAt: '2024-01-15T12:00:00.000Z',
      deficiencyCount: 0,
      deficiencies: [],
      hasCertificationSnapshot: true,
      addendums: [],
      appendOnlyMessage: 'Append-only',
    })

    const res = await client()[':id'].record.$get({ param: { id: 'insp-1' } })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.inspectionId).toBe('insp-1')
  })

  it('POST /:id/addendum creates addendum', async () => {
    vi.mocked(inspectionService.createAddendum).mockResolvedValue({
      id: 'add-1',
      inspectionId: 'insp-1',
      reason: 'Correction',
      content: 'Details',
      createdById: 'admin-1',
      createdAt: new Date('2024-01-16T10:00:00.000Z'),
      signature: 'data:image/png;base64,x',
    })
    vi.mocked(adminInspectionRecordService.getAddendum).mockResolvedValue({
      id: 'add-1',
      inspectionId: 'insp-1',
      reason: 'Correction',
      content: 'Details',
      createdById: 'admin-1',
      createdAt: '2024-01-16T10:00:00.000Z',
      signature: 'data:image/png;base64,x',
    })

    const res = await client()[':id'].addendum.$post({
      param: { id: 'insp-1' },
      json: {
        reason: 'Correction',
        content: 'Details',
        signature: 'data:image/png;base64,x',
      },
    })
    expect(res.status).toBe(201)
    expect(inspectionService.createAddendum).toHaveBeenCalledWith('insp-1', 'admin-1', {
      reason: 'Correction',
      content: 'Details',
      signature: 'data:image/png;base64,x',
    })
  })

  it('GET /:id/addendums/:addendumId returns addendum', async () => {
    vi.mocked(adminInspectionRecordService.getAddendum).mockResolvedValue({
      id: 'add-1',
      inspectionId: 'insp-1',
      reason: 'Correction',
      content: 'Details',
      createdById: 'admin-1',
      createdAt: '2024-01-16T10:00:00.000Z',
      signature: null,
    })

    const res = await client()[':id'].addendums[':addendumId'].$get({
      param: { id: 'insp-1', addendumId: 'add-1' },
    })
    expect(res.status).toBe(200)
  })

  it('GET /:id/workflow returns workflow detail', async () => {
    vi.mocked(inspectionWorkflowService.getAdminDetail).mockResolvedValue({
      inspectionId: 'insp-1',
      permitNumber: 'P-001',
      address: '123 Main',
      status: 'IN_PROGRESS',
      isFinalized: false,
      stages: ['FOUNDATION'],
      noFurtherInspectionsRequired: false,
      reInspectionFeeFlagged: false,
      permitReInspectionFeeFlagged: false,
    })

    const res = await client()[':id'].workflow.$get({ param: { id: 'insp-1' } })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.inspectionId).toBe('insp-1')
  })

  it('GET /:id/certification-snapshot returns snapshot', async () => {
    vi.mocked(inspectionCertificationSnapshotService.getByInspectionId).mockResolvedValue({
      inspectionId: 'insp-1',
      finalizedAt: '2024-01-15T12:00:00.000Z',
      snapshot: { certifications: [] },
      snapshotHash: 'abc',
    })

    const res = await client()[':id']['certification-snapshot'].$get({ param: { id: 'insp-1' } })
    expect(res.status).toBe(200)
  })
})
