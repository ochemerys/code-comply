import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { integrationDb as db } from '../../src/test-utils/integration-db.js'
import type { DeficiencyDTO } from '@codecomply/validators'

const ROUTE_USER = `deficiency-routes-user-${Date.now()}`

vi.mock('../../src/middleware/auth.middleware.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/middleware/auth.middleware.js')>()
  return {
    ...actual,
    authMiddleware: vi.fn(
      async (c: { set: (k: string, v: string) => void }, next: () => Promise<void>) => {
        c.set('userId', ROUTE_USER)
        await next()
      },
    ),
  }
})

const { app } = await import('../../src/app.js')
import { deficiencyNotificationHooks } from '../../src/services/deficiency.service.js'

describe.sequential('Deficiency HTTP routes (M6-S4)', () => {
  let inspectionId: string
  let permitId: string

  beforeAll(async () => {
    await db.photo.deleteMany()
    await db.deficiency.deleteMany()
    await db.inspectionSchedule.deleteMany()
    await db.permitInspection.deleteMany()
    await db.permit.deleteMany()
    await db.user.deleteMany({ where: { id: ROUTE_USER } })

    await db.user.create({
      data: {
        id: ROUTE_USER,
        email: `m6-s4-routes-${Date.now()}@example.com`,
        name: 'M6 S4 Routes',
        role: 'SCO',
      },
    })

    const permit = await db.permit.create({
      data: {
        permitNumber: `M6-S4-RT-${Date.now()}`,
        address: 'Deficiency routes test',
        scope: 'Test',
      },
    })
    permitId = permit.id

    const inspection = await db.permitInspection.create({
      data: {
        permitId,
        scheduledDate: new Date('2026-07-01'),
        status: 'IN_PROGRESS',
        notes: 'M6-S4 deficiency routes',
      },
    })
    inspectionId = inspection.id

    await db.inspectionSchedule.create({
      data: { inspectionId, assignedToId: ROUTE_USER },
    })
  })

  afterAll(async () => {
    await db.photo.deleteMany({ where: { inspectionId } })
    await db.deficiency.deleteMany({ where: { inspectionId } })
    await db.inspectionSchedule.deleteMany({ where: { inspectionId } })
    await db.permitInspection.deleteMany({ where: { id: inspectionId } })
    await db.permit.deleteMany({ where: { id: permitId } })
    await db.user.deleteMany({ where: { id: ROUTE_USER } })
  })

  beforeEach(async () => {
    await db.photo.deleteMany({ where: { inspectionId } })
    await db.deficiency.deleteMany({ where: { inspectionId } })
    vi.restoreAllMocks()
  })

  it('lists, creates, gets, filters, patches with If-Match, stop-work, deletes', async () => {
    const listEmpty = await app.request(`/api/deficiencies?inspectionId=${inspectionId}`)
    expect(listEmpty.status).toBe(200)
    expect(await listEmpty.json()).toEqual([])

    const clientId = `m6-s4-cli-${Date.now()}`
    const post = await app.request('/api/deficiencies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId,
        inspectionId,
        description: 'Integration route create body',
        severity: 'MAJOR',
      }),
    })
    expect(post.status).toBe(201)
    const created = (await post.json()) as DeficiencyDTO
    expect(created.id).toBeDefined()
    expect(created.description).toContain('Integration')

    const listFiltered = await app.request(
      `/api/deficiencies?inspectionId=${inspectionId}&severity=MAJOR`,
    )
    expect(listFiltered.status).toBe(200)
    const listed = (await listFiltered.json()) as { id: string }[]
    expect(listed.some((d) => d.id === created.id)).toBe(true)

    const getOne = await app.request(`/api/deficiencies/${created.id}`)
    expect(getOne.status).toBe(200)

    const row = await db.deficiency.findUniqueOrThrow({ where: { id: created.id } })
    const etag = row.etag ?? ''

    const patch = await app.request(`/api/deficiencies/${created.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'If-Match': etag,
      },
      body: JSON.stringify({ description: 'Patched description text long enough' }),
    })
    expect(patch.status).toBe(200)
    expect(patch.headers.get('ETag')).toBeTruthy()
    expect(patch.headers.get('ETag')).not.toBe(etag)

    const notify = vi.spyOn(deficiencyNotificationHooks, 'onStopWorkOrderIssued')
    const sw = await app.request(`/api/deficiencies/${created.id}/stop-work`, { method: 'POST' })
    expect(sw.status).toBe(200)
    const swo = (await sw.json()) as { deficiencyId: string; id: string }
    expect(swo.deficiencyId).toBe(created.id)
    expect(notify).toHaveBeenCalled()

    const del = await app.request(`/api/deficiencies/${created.id}`, { method: 'DELETE' })
    expect(del.status).toBe(204)

    const gone = await app.request(`/api/deficiencies/${created.id}`)
    expect(gone.status).toBe(404)
  })

  it('returns 409 when If-Match does not match', async () => {
    const clientId = `m6-s4-etag-${Date.now()}`
    const post = await app.request('/api/deficiencies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId,
        inspectionId,
        description: 'Etag conflict scenario description',
        severity: 'MINOR',
      }),
    })
    const created = (await post.json()) as { id: string }

    const conflict = await app.request(`/api/deficiencies/${created.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'If-Match': 'stale-etag-value',
      },
      body: JSON.stringify({ description: 'Should not apply this patch text' }),
    })
    expect(conflict.status).toBe(409)
  })
})
