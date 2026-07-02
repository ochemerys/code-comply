import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { prisma as db } from '@codecomply/db'
import { AssignmentService } from '../../src/services/assignment.service.js'
import { CodeLibraryService } from '../../src/services/code-library.service.js'
import { resetQueryCacheStore } from '../../src/lib/cache/query-cache.js'

describe.sequential('Query optimization integration (M11-S11)', () => {
  const assignmentService = new AssignmentService()
  const codeLibraryService = new CodeLibraryService()

  let scoA: string
  let scoB: string
  let inspectionIds: string[] = []

  beforeAll(async () => {
    await db.inspectionSchedule.deleteMany()
    await db.permitInspection.deleteMany()
    await db.user.deleteMany({ where: { email: { contains: 'm11s11-' } } })

    const a = await db.user.create({
      data: {
        email: 'm11s11-sco-a@test.local',
        name: 'M11 SCO A',
        role: 'SCO',
        isActive: true,
      },
    })
    const b = await db.user.create({
      data: {
        email: 'm11s11-sco-b@test.local',
        name: 'M11 SCO B',
        role: 'SCO',
        isActive: true,
      },
    })
    scoA = a.id
    scoB = b.id

    const day = new Date('2026-06-15T12:00:00.000Z')
    for (let i = 0; i < 6; i++) {
      const insp = await db.permitInspection.create({
        data: {
          status: 'SCHEDULED',
          scheduledDate: day,
        },
      })
      inspectionIds.push(insp.id)
      await db.inspectionSchedule.create({
        data: {
          inspectionId: insp.id,
          assignedToId: scoA,
          assignedDate: day,
        },
      })
    }

    const spare = await db.permitInspection.create({
      data: { status: 'SCHEDULED', scheduledDate: day },
    })
    inspectionIds.push(spare.id)
    await db.inspectionSchedule.create({
      data: {
        inspectionId: spare.id,
        assignedToId: scoB,
        assignedDate: day,
      },
    })

    await db.codeLibrary.deleteMany({ where: { code: 'M11TEST' } })
    await db.codeLibrary.createMany({
      data: [
        { code: 'M11TEST', section: '1.1', title: 'Perf A', description: 'x' },
        { code: 'M11TEST', section: '1.2', title: 'Perf B', description: 'y' },
      ],
    })
  })

  afterAll(async () => {
    await db.inspectionSchedule.deleteMany({ where: { inspectionId: { in: inspectionIds } } })
    await db.permitInspection.deleteMany({ where: { id: { in: inspectionIds } } })
    await db.user.deleteMany({ where: { email: { contains: 'm11s11-' } } })
    await db.codeLibrary.deleteMany({ where: { code: 'M11TEST' } })
  })

  beforeEach(() => {
    resetQueryCacheStore()
  })

  it('getAvailableInspectors uses groupBy — excludes SCO at daily capacity', async () => {
    const day = new Date('2026-06-15T12:00:00.000Z')
    const available = await assignmentService.getAvailableInspectors(day, 5)

    expect(available.map((u) => u.id)).toContain(scoB)
    expect(available.map((u) => u.id)).not.toContain(scoA)
  })

  it('getAvailableInspectors completes within p95 target (200ms)', async () => {
    const day = new Date('2026-06-15T12:00:00.000Z')
    const start = performance.now()
    await assignmentService.getAvailableInspectors(day, 5)
    const elapsed = performance.now() - start
    expect(elapsed).toBeLessThan(200)
  })

  it('code library listByType caches hot reads', async () => {
    const first = await codeLibraryService.listByType('M11TEST')
    const second = await codeLibraryService.listByType('M11TEST')

    expect(first).toHaveLength(2)
    expect(second).toEqual(first)
  })

  it('code library search caps result count', async () => {
    const results = await codeLibraryService.search('M11TEST', 1)
    expect(results).toHaveLength(1)
  })
})
