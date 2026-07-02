import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { User } from '@codecomply/db'
import { integrationDb as db } from '../../src/test-utils/integration-db.js'
import deficienciesRoutes from '../../src/routes/deficiencies.js'
import vocRoutes from '../../src/routes/voc.js'

describe.sequential('VoC API integration (M10-S10)', () => {
  let inspectorId: string
  let adminId: string
  let inspectorUser: User
  let adminUser: User
  let inspectionId: string
  let deficiencyId: string

  const submitBody = {
    verificationDate: '2026-11-02T12:00:00.000Z',
    sectionTitle: 'Division B — Safety',
    title: 'Guardrail corrected',
    name: 'Building Owner LLC',
    method: 'SITE_VISIT' as const,
    comments: 'Verified on site.',
  }

  const createApp = (user: User) => {
    const app = new Hono<{ Variables: { userId: string; user: User } }>()
    app.use('*', async (c, next) => {
      c.set('userId', user.id)
      c.set('user', user)
      await next()
    })
    app.route('/deficiencies', deficienciesRoutes)
    app.route('/voc', vocRoutes)
    return app
  }

  beforeAll(async () => {
    const inspector = await db.user.create({
      data: {
        email: `m10-s10-voc-insp-${Date.now()}@example.com`,
        name: 'M10 S10 Inspector',
        role: 'SCO',
      },
    })
    inspectorUser = inspector
    inspectorId = inspector.id

    const admin = await db.user.create({
      data: {
        email: `m10-s10-voc-admin-${Date.now()}@example.com`,
        name: 'M10 S10 Admin',
        role: 'ADMIN',
      },
    })
    adminUser = admin
    adminId = admin.id

    const inspection = await db.permitInspection.create({
      data: {
        scheduledDate: new Date('2026-11-01'),
        status: 'IN_PROGRESS',
        notes: 'M10-S10 VoC API integration',
      },
    })
    inspectionId = inspection.id

    await db.inspectionSchedule.create({
      data: { inspectionId, assignedToId: inspectorId },
    })

    const deficiency = await db.deficiency.create({
      data: {
        clientId: `m10-s10-def-${Date.now()}`,
        inspectionId,
        createdById: inspectorId,
        description: 'Missing guardrail',
        severity: 'MAJOR',
        status: 'OPEN',
      },
    })
    deficiencyId = deficiency.id
  })

  afterAll(async () => {
    await db.verificationOfCompliance.deleteMany({ where: { deficiencyId } })
    await db.deficiency.deleteMany({ where: { inspectionId } })
    await db.inspectionSchedule.deleteMany({ where: { inspectionId } })
    await db.permitInspection.deleteMany({ where: { id: inspectionId } })
    await db.user.deleteMany({ where: { id: { in: [inspectorId, adminId] } } })
  })

  beforeEach(async () => {
    await db.verificationOfCompliance.deleteMany({ where: { deficiencyId } })
    await db.deficiency.update({
      where: { id: deficiencyId },
      data: {
        status: 'OPEN',
        vocSubmittedAt: null,
        vocAcceptedAt: null,
        vocRejectedAt: null,
        vocNotes: null,
      },
    })
  })

  it('POST /deficiencies/:id/voc submits VoC', async () => {
    const app = createApp(inspectorUser)
    const res = await app.request(`/deficiencies/${deficiencyId}/voc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(submitBody),
    })

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.status).toBe('PENDING')
    expect(body.deficiencyId).toBe(deficiencyId)
  })

  it('GET /voc/pending lists submitted VoC for admin', async () => {
    const inspectorApp = createApp(inspectorUser)
    await inspectorApp.request(`/deficiencies/${deficiencyId}/voc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(submitBody),
    })

    const adminApp = createApp(adminUser)
    const res = await adminApp.request('/voc/pending')

    expect(res.status).toBe(200)
    const rows = await res.json()
    expect(rows.some((r: { deficiencyId: string }) => r.deficiencyId === deficiencyId)).toBe(true)
  })

  it('POST /voc/:id/review accepts VoC and closes deficiency', async () => {
    const inspectorApp = createApp(inspectorUser)
    const submitRes = await inspectorApp.request(`/deficiencies/${deficiencyId}/voc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(submitBody),
    })
    const submitted = await submitRes.json()

    const adminApp = createApp(adminUser)
    const reviewRes = await adminApp.request(`/voc/${submitted.id}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision: 'ACCEPTED', comments: 'Approved' }),
    })

    expect(reviewRes.status).toBe(200)
    const reviewed = await reviewRes.json()
    expect(reviewed.status).toBe('ACCEPTED')

    const deficiency = await db.deficiency.findUniqueOrThrow({ where: { id: deficiencyId } })
    expect(deficiency.status).toBe('CLOSED')
    expect(deficiency.vocNotes).toBe('Approved')
  })

  it('non-admin cannot list pending VoC', async () => {
    const app = createApp(inspectorUser)
    const res = await app.request('/voc/pending')
    expect(res.status).toBe(403)
  })
})
