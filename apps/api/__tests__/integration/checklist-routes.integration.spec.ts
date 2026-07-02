import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { integrationDb as db } from '../../src/test-utils/integration-db.js'

const ROUTE_TEST_USER = `checklist-routes-user-${Date.now()}`

vi.mock('../../src/middleware/auth.middleware.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/middleware/auth.middleware.js')>()
  return {
    ...actual,
    authMiddleware: vi.fn(async (c: any, next: any) => {
      c.set('userId', ROUTE_TEST_USER)
      await next()
    }),
  }
})

const { app } = await import('../../src/app.js')

describe.sequential('Checklist & codes routes (M5-S5)', () => {
  let inspectionId: string
  let templateId: string
  let versionHash: string

  beforeAll(async () => {
    await db.checklistExecution.deleteMany()
    await db.checklistTemplate.deleteMany()
    await db.codeLibrary.deleteMany()
    await db.inspectionSchedule.deleteMany()
    await db.photo.deleteMany()
    await db.deficiency.deleteMany()
    await db.permitInspection.deleteMany()
    await db.permit.deleteMany()

    await db.user.create({
      data: {
        id: ROUTE_TEST_USER,
        email: `checklist-routes-${Date.now()}@example.com`,
        name: 'Route Test',
        role: 'SCO',
      },
    })

    const permit = await db.permit.create({
      data: {
        permitNumber: `M5-S5-RT-${Date.now()}`,
        address: 'Route checklist test',
        scope: 'Test',
      },
    })

    const inspection = await db.permitInspection.create({
      data: {
        permitId: permit.id,
        scheduledDate: new Date('2026-07-01'),
        status: 'IN_PROGRESS',
      },
    })
    inspectionId = inspection.id

    await db.inspectionSchedule.create({
      data: {
        inspectionId: inspection.id,
        assignedToId: ROUTE_TEST_USER,
      },
    })

    versionHash = `sha256:m5-s5-${Date.now()}`
    const template = await db.checklistTemplate.create({
      data: {
        name: 'API route template',
        discipline: 'Building',
        version: 1,
        versionHash,
        items: [{ id: 'item-1', order: 1, text: 'Check wiring', isRequired: true }],
        isActive: true,
      },
    })
    templateId = template.id

    await db.codeLibrary.createMany({
      data: [
        { code: 'NBC', section: '9.10.1', title: 'Fire separation', description: null },
        { code: 'NBC', section: '9.23.1', title: 'Wood framing', description: null },
      ],
    })
  })

  afterAll(async () => {
    await db.checklistExecution.deleteMany()
    await db.checklistTemplate.deleteMany()
    await db.codeLibrary.deleteMany()
    await db.inspectionSchedule.deleteMany()
    await db.photo.deleteMany()
    await db.deficiency.deleteMany()
    await db.permitInspection.deleteMany()
    await db.permit.deleteMany()
    await db.user.deleteMany({ where: { id: ROUTE_TEST_USER } })
  })

  it('GET /api/checklists/templates lists templates', async () => {
    const res = await app.request(`/api/checklists/templates?discipline=Building`)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(Array.isArray(data)).toBe(true)
    expect(data.some((t: { id: string }) => t.id === templateId)).toBe(true)
  })

  it('GET /api/checklists/templates/:id returns template', async () => {
    const res = await app.request(`/api/checklists/templates/${templateId}`)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.id).toBe(templateId)
    expect(data.versionHash).toBe(versionHash)
  })

  it('POST /api/checklists/executions, GET execution, and PATCH responses', async () => {
    const post = await app.request('/api/checklists/executions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inspectionId, templateId }),
    })
    expect(post.status).toBe(201)
    const exec = await post.json()
    expect(exec.id).toBeDefined()
    expect(exec.progress).toBe(0)

    const getExec = await app.request(`/api/checklists/executions/${exec.id}`)
    expect(getExec.status).toBe(200)
    const got = await getExec.json()
    expect(got.id).toBe(exec.id)
    expect(got.templateId).toBe(templateId)
    expect(got.versionHash).toBe(versionHash)

    const patch = await app.request(`/api/checklists/executions/${exec.id}/responses`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        itemId: 'item-1',
        result: 'PASS',
        timestamp: '2026-07-01T12:00:00.000Z',
      }),
    })
    expect(patch.status).toBe(200)
    const updated = await patch.json()
    expect(updated.progress).toBe(100)
  })

  it('GET /api/codes searches and resolves by path', async () => {
    const search = await app.request('/api/codes?q=Fire')
    expect(search.status).toBe(200)
    const list = await search.json()
    expect(list.some((r: { section: string }) => r.section === '9.10.1')).toBe(true)

    const byPath = await app.request('/api/codes/NBC/9.23.1')
    expect(byPath.status).toBe(200)
    const row = await byPath.json()
    expect(row.title).toBe('Wood framing')
  })

  it('GET /api/codes returns 400 without q or type', async () => {
    const res = await app.request('/api/codes')
    expect(res.status).toBe(400)
  })
})
