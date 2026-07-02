import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import type { SyncMutation } from '@codecomply/validators'
import { resetDefaultRateLimitStore } from '../../src/middleware/rate-limit.js'
import {
  LOAD_TEST_API_CONCURRENCY,
  LOAD_TEST_API_P95_MS,
  LOAD_TEST_MAX_HEAP_GROWTH_BYTES,
  LOAD_TEST_SYNC_CONCURRENCY,
  LOAD_TEST_SYNC_SUCCESS_RATE,
} from '../../src/lib/load-test/load-test-config.js'
import {
  captureMemoryProfile,
  summarizeLoadTest,
  topSlowest,
} from '../../src/lib/load-test/load-test-metrics.js'
import { runConcurrentLoad } from '../../src/lib/load-test/load-test-runner.js'
const TEST_USER_ID = `load-test-user-${Date.now()}-${Math.random()}`

vi.mock('../../src/middleware/auth.middleware.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/middleware/auth.middleware.js')>()
  return {
    ...actual,
    authMiddleware: vi.fn(async (c, next) => {
      c.set('userId', TEST_USER_ID)
      await next()
    }),
  }
})

const { app } = await import('../../src/app.js')

const { integrationDb: db } = await import('../../src/test-utils/integration-db.js')

describe.sequential('Load testing integration (M11-S13)', () => {
  let testInspectionId: string

  beforeAll(async () => {
    await db.user.create({
      data: {
        id: TEST_USER_ID,
        email: `load-test-${Date.now()}@example.com`,
        name: 'Load Test User',
        role: 'SCO',
      },
    })

    const inspection = await db.permitInspection.create({
      data: {
        id: `load-test-insp-${Date.now()}`,
        scheduledDate: new Date(),
        status: 'SCHEDULED',
      },
    })
    testInspectionId = inspection.id

    await db.inspectionSchedule.create({
      data: {
        inspectionId: testInspectionId,
        assignedToId: TEST_USER_ID,
      },
    })
  })

  afterAll(async () => {
    await db.deficiency.deleteMany({ where: { inspectionId: testInspectionId } })
    await db.inspectionSchedule.deleteMany({ where: { inspectionId: testInspectionId } })
    await db.permitInspection.deleteMany({ where: { id: testInspectionId } })
    await db.user.deleteMany({ where: { id: TEST_USER_ID } })
  })

  beforeEach(() => {
    process.env.RATE_LIMIT_API_MAX = '5000'
    process.env.RATE_LIMIT_UPLOAD_MAX = '5000'
    resetDefaultRateLimitStore()
  })

  it(`handles ${LOAD_TEST_SYNC_CONCURRENCY} concurrent sync pushes with >99% success`, async () => {
    const heapBefore = process.memoryUsage()

    const { timings } = await runConcurrentLoad(
      LOAD_TEST_SYNC_CONCURRENCY,
      async (index) => {
        const mutations: SyncMutation[] = [
          {
            clientId: crypto.randomUUID(),
            entity: 'deficiency',
            operation: 'create',
            payload: {
              inspectionId: testInspectionId,
              description: `Load sync ${index}`,
              severity: 'MINOR',
              location: `Zone ${index}`,
            },
            timestamp: new Date().toISOString(),
          },
        ]

        const res = await app.request('/api/sync/push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mutations }),
        })

        if (!res.ok) {
          const body = await res.text()
          throw new Error(`sync ${index} failed: ${res.status} ${body}`)
        }
        return res.json()
      },
      { concurrency: 10 },
    )

    const summary = summarizeLoadTest(timings)
    const profile = captureMemoryProfile(heapBefore, process.memoryUsage())

    expect(summary.successRate).toBeGreaterThanOrEqual(LOAD_TEST_SYNC_SUCCESS_RATE)
    expect(profile.heapGrowthBytes).toBeLessThan(LOAD_TEST_MAX_HEAP_GROWTH_BYTES)
    if (summary.failures.length > 0) {
      expect(topSlowest(timings, 3).length).toBeGreaterThan(0)
    }
  }, 60_000)

  it(`serves ${LOAD_TEST_API_CONCURRENCY} concurrent health checks with p95 < ${LOAD_TEST_API_P95_MS}ms`, async () => {
    const { timings } = await runConcurrentLoad(
      LOAD_TEST_API_CONCURRENCY,
      async () => {
        const res = await app.request('/health')
        if (!res.ok) throw new Error(`health ${res.status}`)
        return res.json()
      },
      { concurrency: 25 },
    )

    const summary = summarizeLoadTest(timings)
    expect(summary.successRate).toBe(1)
    expect(summary.p95Ms).toBeLessThan(LOAD_TEST_API_P95_MS)
  })
})
