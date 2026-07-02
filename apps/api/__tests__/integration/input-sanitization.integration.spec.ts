import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { integrationDb as db } from '../../src/test-utils/integration-db.js'
import type { DeficiencyDTO } from '@codecomply/validators'

const ROUTE_USER = `sanitization-routes-user-${Date.now()}`

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

describe.sequential('Input sanitization integration (M11-S5)', () => {
  let inspectionId: string
  let permitId: string

  beforeAll(async () => {
    await db.deficiency.deleteMany()
    await db.inspectionSchedule.deleteMany()
    await db.permitInspection.deleteMany()
    await db.permit.deleteMany()
    await db.user.deleteMany({ where: { id: ROUTE_USER } })

    await db.user.create({
      data: {
        id: ROUTE_USER,
        email: `m11-s5-${Date.now()}@example.com`,
        name: 'M11 S5 Sanitization',
        role: 'SCO',
      },
    })

    const permit = await db.permit.create({
      data: {
        permitNumber: `M11-S5-${Date.now()}`,
        address: 'Sanitization integration test',
        scope: 'Test',
      },
    })
    permitId = permit.id

    const inspection = await db.permitInspection.create({
      data: {
        permitId,
        scheduledDate: new Date('2026-07-01'),
        status: 'IN_PROGRESS',
        notes: 'M11-S5 sanitization routes',
      },
    })
    inspectionId = inspection.id

    await db.inspectionSchedule.create({
      data: { inspectionId, assignedToId: ROUTE_USER },
    })
  })

  afterAll(async () => {
    await db.deficiency.deleteMany({ where: { inspectionId } })
    await db.inspectionSchedule.deleteMany({ where: { inspectionId } })
    await db.permitInspection.deleteMany({ where: { id: inspectionId } })
    await db.permit.deleteMany({ where: { id: permitId } })
    await db.user.deleteMany({ where: { id: ROUTE_USER } })
  })

  beforeEach(async () => {
    await db.deficiency.deleteMany({ where: { inspectionId } })
  })

  it('strips XSS payloads from deficiency descriptions on create', async () => {
    const clientId = `m11-s5-xss-${Date.now()}`
    const xssDescription =
      '<script>alert("xss")</script>Missing GFCI protection in required locations.'

    const post = await app.request('/api/deficiencies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId,
        inspectionId,
        description: xssDescription,
        severity: 'MAJOR',
      }),
    })

    expect(post.status).toBe(201)
    const created = (await post.json()) as DeficiencyDTO
    expect(created.description).not.toContain('<script>')
    expect(created.description).toContain('Missing GFCI protection')
  })

  it('neutralizes SQL injection patterns in text fields on create', async () => {
    const clientId = `m11-s5-sql-${Date.now()}`
    const sqlDescription = "'; DROP TABLE deficiencies; -- Major wiring issue found here."

    const post = await app.request('/api/deficiencies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId,
        inspectionId,
        description: sqlDescription,
        severity: 'MAJOR',
      }),
    })

    expect(post.status).toBe(201)
    const created = (await post.json()) as DeficiencyDTO
    expect(created.description).not.toContain("'")
    expect(created.description).not.toContain(';')
    expect(created.description).toContain('Major wiring issue found here')
  })

  it('strips NoSQL operator keys from JSON metadata payloads', async () => {
    const clientId = `m11-s5-nosql-${Date.now()}`

    const post = await app.request('/api/deficiencies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId,
        inspectionId,
        description: 'Unsafe condition observed at service panel location.',
        severity: 'CRITICAL',
        codeReference: {
          code: 'NBC',
          section: '26-722',
          title: 'GFCI',
          $where: '1==1',
        },
      }),
    })

    expect(post.status).toBe(201)
    const created = (await post.json()) as DeficiencyDTO
    expect(created.codeReference).toEqual({
      code: 'NBC',
      section: '26-722',
      title: 'GFCI',
    })
  })
})
