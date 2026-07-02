import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { integrationDb as db } from '../../src/test-utils/integration-db.js'
import { runSecurityAudit, PENETRATION_PROBE_PAYLOADS } from '../../src/lib/security-audit.js'
import { DEFAULT_SECURITY_HEADERS } from '../../src/middleware/security-headers.js'

const ROUTE_USER = `security-audit-user-${Date.now()}`

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

describe.sequential('Security audit integration (M11-S7)', () => {
  let inspectionId: string

  beforeAll(async () => {
    await db.deficiency.deleteMany()
    await db.inspectionSchedule.deleteMany()
    await db.permitInspection.deleteMany()
    await db.permit.deleteMany()
    await db.user.deleteMany({ where: { id: ROUTE_USER } })

    await db.user.create({
      data: {
        id: ROUTE_USER,
        email: `m11-s7-${Date.now()}@example.com`,
        name: 'M11 S7 Audit',
        role: 'SCO',
      },
    })

    const permit = await db.permit.create({
      data: {
        permitNumber: `M11-S7-${Date.now()}`,
        address: 'Security audit integration test',
        scope: 'Test',
      },
    })

    const inspection = await db.permitInspection.create({
      data: {
        permitId: permit.id,
        scheduledDate: new Date('2026-08-01'),
        status: 'IN_PROGRESS',
        notes: 'M11-S7 penetration probes',
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
    await db.user.deleteMany({ where: { id: ROUTE_USER } })
  })

  it('includes security headers on health responses', async () => {
    const res = await app.request('/health')
    expect(res.status).toBe(200)
    for (const [name, value] of Object.entries(DEFAULT_SECURITY_HEADERS)) {
      expect(res.headers.get(name), `missing ${name}`).toBe(value)
    }
  })

  it('passes full security audit against live API headers', async () => {
    const res = await app.request('/health')
    const report = await runSecurityAudit({ responseHeaders: res.headers })
    expect(report.passed).toBe(true)
    expect(report.owasp.every((c) => c.passed)).toBe(true)
  })

  it('penetration: blocks SQL injection in deficiency descriptions', async () => {
    const clientId = `m11-s7-sqli-${Date.now()}`
    const description = `${PENETRATION_PROBE_PAYLOADS.sqlInjection} Major wiring issue found here.`
    const res = await app.request('/api/deficiencies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId,
        inspectionId,
        description,
        severity: 'MAJOR',
      }),
    })
    expect(res.status).toBe(201)
    const body = (await res.json()) as { description: string }
    expect(body.description).not.toContain("'")
    expect(body.description).not.toContain(';')
    expect(body.description).toContain('Major wiring issue found here')
  })

  it('penetration: strips XSS from deficiency descriptions', async () => {
    const clientId = `m11-s7-xss-${Date.now()}`
    const description = `${PENETRATION_PROBE_PAYLOADS.xss}Missing GFCI protection in required locations.`
    const res = await app.request('/api/deficiencies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId,
        inspectionId,
        description,
        severity: 'MAJOR',
      }),
    })
    expect(res.status).toBe(201)
    const body = (await res.json()) as { description: string }
    expect(body.description).not.toContain('<script>')
  })

  it('penetration: rejects unauthenticated admin access', async () => {
    const res = await app.request('/api/admin/users', {
      headers: { 'Content-Type': 'application/json' },
    })
    expect(res.status).toBe(401)
  })
})
