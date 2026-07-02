/**
 * Integration tests for Photo model (M7-S1) — queries by inspection and storage state.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prismaForDbTests } from '../helpers/test-prisma.js'

const prisma = prismaForDbTests()

describe('Photo integration (M7-S1)', () => {
  let userId: string
  let inspectionId: string

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        email: `photo-int-${Date.now()}@example.com`,
        name: 'Photo Integration',
        role: 'SCO',
      },
    })
    userId = user.id
    const inspection = await prisma.permitInspection.create({
      data: {
        scheduledDate: new Date('2026-08-01'),
        status: 'IN_PROGRESS',
      },
    })
    inspectionId = inspection.id

    const meta = {
      timestamp: new Date().toISOString(),
      gps: { latitude: 53.5, longitude: -113.5, accuracy: 5 },
      inspectorId: userId,
      permitNumber: 'BP-INT-001',
      deviceInfo: 'integration',
    }

    await prisma.photo.createMany({
      data: [
        {
          clientId: `int-photo-a-${Date.now()}`,
          inspectionId,
          filename: 'synced.jpg',
          mimeType: 'image/jpeg',
          size: 1000,
          metadata: meta,
          storageKey: 'r2/bucket/synced.jpg',
          syncedAt: new Date(),
        },
        {
          clientId: `int-photo-b-${Date.now()}`,
          inspectionId,
          filename: 'pending.jpg',
          mimeType: 'image/jpeg',
          size: 2000,
          metadata: meta,
          storageKey: null,
          syncedAt: null,
        },
      ],
    })
  })

  afterAll(async () => {
    await prisma.photo.deleteMany({ where: { inspectionId } })
    await prisma.permitInspection.deleteMany({ where: { id: inspectionId } })
    await prisma.user.deleteMany({ where: { id: userId } })
    await prisma.$disconnect()
  })

  it('lists photos for an inspection ordered by createdAt', async () => {
    const rows = await prisma.photo.findMany({
      where: { inspectionId },
      orderBy: { createdAt: 'asc' },
    })
    expect(rows).toHaveLength(2)
    expect(rows.every((p) => p.inspectionId === inspectionId)).toBe(true)
  })

  it('finds photos pending upload (no storageKey)', async () => {
    const pending = await prisma.photo.findMany({
      where: { inspectionId, storageKey: null },
    })
    expect(pending).toHaveLength(1)
    expect(pending[0]!.filename).toBe('pending.jpg')
  })

  it('finds synced photos', async () => {
    const synced = await prisma.photo.findMany({
      where: { inspectionId, syncedAt: { not: null } },
    })
    expect(synced).toHaveLength(1)
    expect(synced[0]!.storageKey).toContain('r2/')
  })
})
