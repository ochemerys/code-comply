import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Hono } from 'hono'
import type { User } from '@codecomply/db'
import vocRoutes from './voc.js'
import { vocService } from '../services/voc.service.js'

vi.mock('../services/voc.service.js', () => ({
  vocService: {
    listPending: vi.fn(),
    review: vi.fn(),
  },
}))

vi.mock('../services/audit-log.service.js', () => ({
  AUDIT_ENTITY: { SECURITY: 'Security' },
  AUDIT_ACTION: { RBAC_ACCESS_DENIED: 'RBAC_ACCESS_DENIED' },
  auditLogService: { append: vi.fn().mockResolvedValue({ id: 'audit-1' }) },
}))

const createTestApp = (role: 'ADMIN' | 'SCO' = 'ADMIN') => {
  const userId = role === 'ADMIN' ? 'admin-1' : 'sco-1'
  const user = { id: userId, role } as User
  const testApp = new Hono<{ Variables: { userId: string; user: User } }>()
  testApp.use('*', async (c, next) => {
    c.set('userId', userId)
    c.set('user', user)
    await next()
  })
  testApp.route('/', vocRoutes)
  return testApp
}

describe('VoC routes (M10-S10)', () => {
  const submittedAt = new Date('2026-11-02T12:00:00.000Z')

  const sampleVoC = {
    id: 'voc-1',
    deficiencyId: 'def-1',
    verificationDate: new Date('2026-11-02T10:00:00.000Z'),
    sectionTitle: 'Division B',
    title: 'Corrected',
    name: 'Owner',
    method: 'SITE_VISIT' as const,
    comments: 'OK',
    submittedAt,
    reviewedAt: null,
    reviewedById: null,
    status: 'PENDING' as const,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('GET /pending returns VoC DTOs for admin', async () => {
    vi.mocked(vocService.listPending).mockResolvedValue([sampleVoC] as any)

    const app = createTestApp('ADMIN')
    const res = await app.request('/pending')

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(1)
    expect(body[0].id).toBe('voc-1')
    expect(vocService.listPending).toHaveBeenCalledWith('admin-1')
  })

  it('GET /pending returns 403 for non-admin', async () => {
    const app = createTestApp('SCO')
    const res = await app.request('/pending')

    expect(res.status).toBe(403)
    expect(vocService.listPending).not.toHaveBeenCalled()
  })

  it('POST /:id/review returns reviewed VoC DTO', async () => {
    vi.mocked(vocService.review).mockResolvedValue({
      ...sampleVoC,
      status: 'ACCEPTED',
      reviewedAt: new Date('2026-11-03T09:00:00.000Z'),
      reviewedById: 'admin-1',
    } as any)

    const app = createTestApp('ADMIN')
    const res = await app.request('/voc-1/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision: 'ACCEPTED', comments: 'Looks good' }),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ACCEPTED')
    expect(vocService.review).toHaveBeenCalledWith('voc-1', 'ACCEPTED', 'admin-1', 'Looks good')
  })

  it('POST /:id/review returns 403 when reviewer is not admin', async () => {
    const app = createTestApp('SCO')
    const res = await app.request('/voc-1/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision: 'REJECTED' }),
    })

    expect(res.status).toBe(403)
    expect(vocService.review).not.toHaveBeenCalled()
  })

  it('POST /:id/review returns 404 when VoC is missing', async () => {
    vi.mocked(vocService.review).mockRejectedValue(new Error('VoC not found'))

    const app = createTestApp('ADMIN')
    const res = await app.request('/missing/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision: 'ACCEPTED' }),
    })

    expect(res.status).toBe(404)
  })
})
