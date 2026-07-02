import { describe, it, expect, beforeEach, vi } from 'vitest'
import { testClient } from 'hono/testing'
import { Hono } from 'hono'
import type { User } from '@codecomply/db'
import complianceSearchApp from './compliance-search'
import { complianceSearchService } from '../../services/compliance-search.service.js'
import { roleMiddleware } from '../../middleware/auth.middleware'

vi.mock('../../services/compliance-search.service')

type ComplianceSearchTestClient = {
  index: { $get: (opts: { query?: Record<string, unknown> }) => Promise<Response> }
}

const createAdminTestApp = () => {
  const testApp = new Hono()
  testApp.use('*', async (c, next) => {
    c.set('user', { id: 'admin-1', role: 'ADMIN' } as User)
    c.set('userId', 'admin-1')
    await next()
  })
  testApp.use('*', roleMiddleware(['ADMIN']))
  testApp.route('/', complianceSearchApp)
  return testApp
}

const createForbiddenTestApp = () => {
  const testApp = new Hono()
  testApp.use('*', async (c, next) => {
    c.set('user', { id: 'sco-1', role: 'SCO' } as User)
    c.set('userId', 'sco-1')
    await next()
  })
  testApp.use('*', roleMiddleware(['ADMIN']))
  testApp.route('/', complianceSearchApp)
  return testApp
}

const adminClient = () => testClient(createAdminTestApp()) as ComplianceSearchTestClient
const forbiddenClient = () => testClient(createForbiddenTestApp()) as ComplianceSearchTestClient

describe('Admin compliance search routes (M10-S16)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('GET / returns search results', async () => {
    vi.mocked(complianceSearchService.search).mockResolvedValue({
      results: [
        {
          inspectionId: 'insp-1',
          permitNumber: 'P-001',
          address: '123 Main',
          status: 'PASSED',
          scheduledDate: '2024-01-15T10:00:00.000Z',
          deficiencyCount: 0,
        },
      ],
      total: 1,
      searchAuditId: 'audit-abc',
    })

    const res = await adminClient().index.$get({
      query: { permitNumber: 'P-001', dateFrom: '2024-01-01', dateTo: '2024-12-31' },
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.total).toBe(1)
    expect(body.results).toHaveLength(1)
    expect(complianceSearchService.search).toHaveBeenCalledWith(
      expect.objectContaining({ permitNumber: 'P-001' }),
      'admin-1',
    )
  })

  it('GET / rejects invalid date format', async () => {
    const res = await adminClient().index.$get({ query: { dateFrom: 'bad-date' } })
    expect(res.status).toBe(400)
    expect(complianceSearchService.search).not.toHaveBeenCalled()
  })

  it('GET / returns 403 for non-admin', async () => {
    const res = await forbiddenClient().index.$get({ query: {} })
    expect(res.status).toBe(403)
  })
})
