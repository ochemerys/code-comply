import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma as db } from '@codecomply/db'
import { PermitSyncService } from '../../src/services/permit-sync.service.js'
import { AUDIT_ACTION, AUDIT_ENTITY } from '../../src/services/audit-log.service.js'

describe.sequential('PermitSyncService integration', () => {
  const service = new PermitSyncService()
  let testUserId: string

  beforeEach(async () => {
    await db.municipalPermitFeedEntry.deleteMany()
    await db.permit.deleteMany()

    const user = await db.user.create({
      data: {
        email: `permit-sync-test-${Date.now()}@example.com`,
        name: 'Permit Sync Tester',
        role: 'ADMIN',
      },
    })
    testUserId = user.id
  })

  afterEach(async () => {
    await db.municipalPermitFeedEntry.deleteMany()
    await db.permit.deleteMany()
    await db.user.deleteMany({ where: { id: testUserId } })
  })

  it('imports new and updated permits from the external municipal feed on first sync', async () => {
    await db.permit.create({
      data: {
        permitNumber: 'BP-2024-001',
        address: '10230 Jasper Avenue, Edmonton, AB T5J 4P6',
        legalLandDesc: 'Plan 1234AB Block 5 Lot 12',
        scope: 'New Construction - Single Family Dwelling',
        status: 'ACTIVE',
      },
    })
    await db.permit.create({
      data: {
        permitNumber: 'BP-2024-002',
        address: '8882 170 Street NW, Edmonton, AB T5T 4J2',
        legalLandDesc: 'Plan 5678CD Block 2 Lot 8',
        scope: 'Renovation - Kitchen and Bathroom',
        status: 'ACTIVE',
      },
    })

    await db.municipalPermitFeedEntry.createMany({
      data: [
        {
          permitNumber: 'BP-2024-001',
          address: '10230 Jasper Avenue, Edmonton, AB T5J 4P6',
          legalLandDesc: 'Plan 1234AB Block 5 Lot 12',
          scope: 'New Construction - Single Family Dwelling',
          status: 'ACTIVE',
        },
        {
          permitNumber: 'BP-2024-002',
          address: '8882 170 Street NW, Edmonton, AB T5T 4J2 (Phase 2 renovation)',
          legalLandDesc: 'Plan 5678CD Block 2 Lot 8',
          scope: 'Renovation - Kitchen, Bathroom, and Ensuite',
          status: 'ACTIVE',
        },
        {
          permitNumber: 'BP-2026-004821',
          address: '4821 Rabbit Hill Road SW, Edmonton, AB T6R 3B4',
          legalLandDesc: 'Plan 4421AB Block 1 Lot 7',
          scope: 'New Construction - Single Family Dwelling',
          status: 'ACTIVE',
        },
      ],
    })

    const result = await service.syncFromMunicipal(testUserId)

    expect(result.newPermits).toBeGreaterThan(0)
    expect(result.updatedPermits).toBeGreaterThan(0)
    expect(result.unchanged).toBeGreaterThan(0)

    const imported = await db.permit.findUnique({ where: { permitNumber: 'BP-2026-004821' } })
    expect(imported).not.toBeNull()

    const updated = await db.permit.findUniqueOrThrow({ where: { permitNumber: 'BP-2024-002' } })
    expect(updated.address).toContain('Phase 2 renovation')
  })

  it('returns zero new and updated counts when the municipal feed is unchanged', async () => {
    const feedRows = [
      {
        permitNumber: 'BP-2024-001',
        address: '10230 Jasper Avenue, Edmonton, AB T5J 4P6',
        legalLandDesc: 'Plan 1234AB Block 5 Lot 12',
        scope: 'New Construction - Single Family Dwelling',
        status: 'ACTIVE' as const,
      },
    ]

    await db.municipalPermitFeedEntry.createMany({ data: feedRows })
    await db.permit.create({ data: feedRows[0] })

    const first = await service.syncFromMunicipal(testUserId)
    expect(first.newPermits).toBe(0)
    expect(first.updatedPermits).toBe(0)
    expect(first.unchanged).toBe(1)

    const second = await service.syncFromMunicipal(testUserId)
    expect(second.newPermits).toBe(0)
    expect(second.updatedPermits).toBe(0)
    expect(second.unchanged).toBe(1)
  })

  it('does not read the local permits table as the municipal feed source', async () => {
    await db.permit.create({
      data: {
        permitNumber: 'BP-LOCAL-ONLY',
        address: '1 Agency Cache Lane',
        scope: 'Local only',
        status: 'ACTIVE',
      },
    })

    await db.municipalPermitFeedEntry.create({
      data: {
        permitNumber: 'BP-FEED-ONLY',
        address: '9 Municipal Feed Way',
        scope: 'From municipal system',
        status: 'ACTIVE',
      },
    })

    const result = await service.syncFromMunicipal(testUserId)

    expect(result.newPermits).toBe(1)
    expect(result.updatedPermits).toBe(0)
    expect(result.unchanged).toBe(0)

    const imported = await db.permit.findUnique({ where: { permitNumber: 'BP-FEED-ONLY' } })
    expect(imported).not.toBeNull()
    expect(await db.permit.findUnique({ where: { permitNumber: 'BP-LOCAL-ONLY' } })).not.toBeNull()

    const syncLogs = await db.auditLog.findMany({
      where: {
        action: AUDIT_ACTION.PERMIT_SYNC,
        entityType: AUDIT_ENTITY.PERMIT,
        userId: testUserId,
      },
    })
    expect(syncLogs).toHaveLength(1)
  })
})
