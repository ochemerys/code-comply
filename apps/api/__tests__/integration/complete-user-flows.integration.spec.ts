/**
 * End-to-end API integration: inspection → deficiency → photo → VoC → finalize → report (M11-S15).
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { User } from '@codecomply/db'
import { integrationDb as db } from '../../src/test-utils/integration-db.js'

const SCO_USER = `m11-s15-sco-${Date.now()}`
const ADMIN_USER = `m11-s15-admin-${Date.now()}`

const putObject = vi.fn(async () => {})
const deleteObject = vi.fn(async () => {})
const getSignedGetUrl = vi.fn(async (_kind: string, key: string) => `https://signed.example/${key}`)

vi.mock('../../src/middleware/auth.middleware.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/middleware/auth.middleware.js')>()
  return {
    ...actual,
    authMiddleware: vi.fn(
      async (
        c: {
          set: (k: string, v: unknown) => void
          req: { header: (n: string) => string | undefined }
        },
        next: () => Promise<void>,
      ) => {
        const userId = c.req.header('x-test-user-id') ?? SCO_USER
        const user = await db.user.findUniqueOrThrow({ where: { id: userId } })
        c.set('userId', user.id)
        c.set('user', user)
        await next()
      },
    ),
  }
})

vi.mock('../../src/lib/storage/storage-client.js', () => ({
  createObjectStorageClientFromEnv: vi.fn(() => ({
    putObject,
    deleteObject,
    getSignedGetUrl,
    getObjectBytes: vi.fn(async () => new Uint8Array()),
  })),
}))

const { app } = await import('../../src/app.js')

function authHeader(userId: string): HeadersInit {
  return { 'x-test-user-id': userId }
}

describe.sequential('Complete user flows — API (M11-S15)', () => {
  let scoUser: User
  let adminUser: User
  let permitId: string
  let inspectionId: string
  let templateId: string
  let deficiencyId: string
  let photoId: string
  let vocId: string

  beforeAll(async () => {
    await db.report.deleteMany()
    await db.photo.deleteMany()
    await db.verificationOfCompliance.deleteMany()
    await db.deficiency.deleteMany()
    await db.checklistExecution.deleteMany()
    await db.checklistTemplate.deleteMany()
    await db.inspectionSchedule.deleteMany()
    await db.permitInspection.deleteMany()
    await db.permit.deleteMany()
    await db.user.deleteMany({ where: { id: { in: [SCO_USER, ADMIN_USER] } } })

    scoUser = await db.user.create({
      data: {
        id: SCO_USER,
        email: `m11-s15-sco-${Date.now()}@example.com`,
        name: 'M11 S15 SCO',
        role: 'SCO',
      },
    })

    adminUser = await db.user.create({
      data: {
        id: ADMIN_USER,
        email: `m11-s15-admin-${Date.now()}@example.com`,
        name: 'M11 S15 Admin',
        role: 'ADMIN',
      },
    })

    const permit = await db.permit.create({
      data: {
        permitNumber: `M11-S15-${Date.now()}`,
        address: 'Complete flows integration',
        scope: 'Residential',
      },
    })
    permitId = permit.id

    const inspection = await db.permitInspection.create({
      data: {
        permitId,
        scheduledDate: new Date('2026-12-01'),
        status: 'IN_PROGRESS',
        notes: 'M11-S15 complete user flows',
      },
    })
    inspectionId = inspection.id

    await db.inspectionSchedule.create({
      data: { inspectionId, assignedToId: SCO_USER },
    })

    const template = await db.checklistTemplate.create({
      data: {
        name: 'M11-S15 Template',
        discipline: 'GENERAL',
        version: 1,
        versionHash: `m11-s15-vh-${Date.now()}`,
        items: [
          { id: 'item-1', title: 'Item 1', required: true, requiresPhoto: false },
          { id: 'item-2', title: 'Item 2', required: true, requiresPhoto: false },
        ],
        isActive: true,
      },
    })
    templateId = template.id

    await db.checklistExecution.create({
      data: {
        inspectionId,
        templateId,
        versionHash: template.versionHash,
        responses: [
          { itemId: 'item-1', result: 'PASS', timestamp: '2026-12-01T10:00:00Z' },
          { itemId: 'item-2', result: 'PASS', timestamp: '2026-12-01T10:05:00Z' },
        ],
        progress: 100,
        completedAt: new Date(),
      },
    })
  })

  afterAll(async () => {
    await db.report.deleteMany({ where: { inspectionId } })
    await db.photo.deleteMany({ where: { inspectionId } })
    await db.verificationOfCompliance.deleteMany()
    await db.deficiency.deleteMany({ where: { inspectionId } })
    await db.checklistExecution.deleteMany({ where: { inspectionId } })
    await db.checklistTemplate.deleteMany({ where: { id: templateId } })
    await db.inspectionSchedule.deleteMany({ where: { inspectionId } })
    await db.permitInspection.deleteMany({ where: { id: inspectionId } })
    await db.permit.deleteMany({ where: { id: permitId } })
    await db.user.deleteMany({ where: { id: { in: [SCO_USER, ADMIN_USER] } } })
  })

  it('deficiency management: create, patch, and error on stale etag', async () => {
    const clientId = `m11-s15-def-${Date.now()}`
    const post = await app.request('/api/deficiencies', {
      method: 'POST',
      headers: { ...authHeader(SCO_USER), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId,
        inspectionId,
        description: 'M11-S15 flow deficiency description',
        severity: 'MAJOR',
      }),
    })
    expect(post.status).toBe(201)
    const created = (await post.json()) as { id: string }
    deficiencyId = created.id

    const row = await db.deficiency.findUniqueOrThrow({ where: { id: deficiencyId } })
    const patch = await app.request(`/api/deficiencies/${deficiencyId}`, {
      method: 'PATCH',
      headers: {
        ...authHeader(SCO_USER),
        'Content-Type': 'application/json',
        'If-Match': row.etag ?? '',
      },
      body: JSON.stringify({ description: 'M11-S15 patched deficiency description text' }),
    })
    expect(patch.status).toBe(200)

    const conflict = await app.request(`/api/deficiencies/${deficiencyId}`, {
      method: 'PATCH',
      headers: {
        ...authHeader(SCO_USER),
        'Content-Type': 'application/json',
        'If-Match': 'stale-etag',
      },
      body: JSON.stringify({ description: 'Should not apply' }),
    })
    expect(conflict.status).toBe(409)
  })

  it('photo capture: upload evidence for inspection', async () => {
    putObject.mockClear()
    const clientId = `m11-s15-photo-${Date.now()}`
    const form = new FormData()
    form.append('inspectionId', inspectionId)
    form.append('clientId', clientId)
    form.append('metadata', JSON.stringify({ source: 'm11-s15-flow' }))
    form.append(
      'file',
      new File([new TextEncoder().encode('evidence')], 'evidence.jpg', { type: 'image/jpeg' }),
    )

    const post = await app.request('/api/photos', {
      method: 'POST',
      headers: authHeader(SCO_USER),
      body: form,
    })
    expect(post.status).toBe(201)
    const created = (await post.json()) as { id: string }
    photoId = created.id
    expect(putObject).toHaveBeenCalled()
  })

  it('VoC submission and admin review closes deficiency', async () => {
    const submitBody = {
      verificationDate: '2026-12-02T12:00:00.000Z',
      sectionTitle: 'Division B',
      title: 'Corrected guardrail',
      name: 'Owner LLC',
      method: 'SITE_VISIT' as const,
      comments: 'Verified on site.',
    }

    const submit = await app.request(`/api/deficiencies/${deficiencyId}/voc`, {
      method: 'POST',
      headers: { ...authHeader(SCO_USER), 'Content-Type': 'application/json' },
      body: JSON.stringify(submitBody),
    })
    expect(submit.status).toBe(201)
    const submitted = (await submit.json()) as { id: string; status: string }
    vocId = submitted.id
    expect(submitted.status).toBe('PENDING')

    const pending = await app.request('/api/voc/pending', {
      headers: authHeader(ADMIN_USER),
    })
    expect(pending.status).toBe(200)
    const rows = (await pending.json()) as Array<{ deficiencyId: string }>
    expect(rows.some((r) => r.deficiencyId === deficiencyId)).toBe(true)

    const forbidden = await app.request('/api/voc/pending', {
      headers: authHeader(SCO_USER),
    })
    expect(forbidden.status).toBe(403)

    const review = await app.request(`/api/voc/${vocId}/review`, {
      method: 'POST',
      headers: { ...authHeader(ADMIN_USER), 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision: 'ACCEPTED', comments: 'Approved in flow test' }),
    })
    expect(review.status).toBe(200)

    const deficiency = await db.deficiency.findUniqueOrThrow({ where: { id: deficiencyId } })
    expect(deficiency.status).toBe('CLOSED')
  })

  it('complete inspection workflow: validate then finalize', async () => {
    const validate = await app.request(`/api/inspections/${inspectionId}/validate`, {
      method: 'POST',
      headers: authHeader(SCO_USER),
    })
    expect(validate.status).toBe(200)
    const validation = (await validate.json()) as { isValid: boolean }
    expect(validation.isValid).toBe(false)

    const finalize = await app.request(`/api/inspections/${inspectionId}/finalize`, {
      method: 'POST',
      headers: { ...authHeader(SCO_USER), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        signature: 'signed-m11-s15',
        outcome: 'PASSED',
        gps: {
          latitude: 51.0447,
          longitude: -114.0719,
          accuracy: 5,
          timestamp: '2026-12-01T11:00:00Z',
        },
      }),
    })
    expect(finalize.status).toBe(200)
    const dto = (await finalize.json()) as { status: string }
    expect(dto.status).toBe('PASSED')

    const row = await db.permitInspection.findUniqueOrThrow({ where: { id: inspectionId } })
    expect(row.finalizedAt).toBeTruthy()
    expect(row.documentHash).toBeTruthy()
  })

  it('report generation: generate and list reports for finalized inspection', async () => {
    putObject.mockClear()

    const generate = await app.request('/api/reports/generate', {
      method: 'POST',
      headers: { ...authHeader(SCO_USER), 'Content-Type': 'application/json' },
      body: JSON.stringify({ inspectionId, type: 'INSPECTION' }),
    })
    expect(generate.status).toBe(201)
    const report = (await generate.json()) as { id: string; inspectionId: string }
    expect(report.inspectionId).toBe(inspectionId)
    expect(putObject).toHaveBeenCalled()

    const list = await app.request(`/api/inspections/${inspectionId}/reports`, {
      headers: authHeader(SCO_USER),
    })
    expect(list.status).toBe(200)
    const reports = (await list.json()) as Array<{ id: string }>
    expect(reports.some((r) => r.id === report.id)).toBe(true)
  })

  it('error handling: 404 for unknown resources and invalid report type', async () => {
    const missingDef = await app.request('/api/deficiencies/nonexistent-id-000', {
      headers: authHeader(SCO_USER),
    })
    expect(missingDef.status).toBe(404)

    const badReport = await app.request('/api/reports/generate', {
      method: 'POST',
      headers: { ...authHeader(SCO_USER), 'Content-Type': 'application/json' },
      body: JSON.stringify({ inspectionId: 'nonexistent-insp', type: 'INSPECTION' }),
    })
    expect(badReport.status).toBe(404)

    expect(photoId).toBeTruthy()
    expect(scoUser.id).toBe(SCO_USER)
    expect(adminUser.id).toBe(ADMIN_USER)
  })
})
