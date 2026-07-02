/**
 * Unit tests for Photo model (M7-S1)
 *
 * Covers clientId uniqueness, metadata/annotations JSON, optional deficiency link,
 * storageKey, and cascade / set-null relations.
 */

import { describe, it, expect, afterEach } from 'vitest'
import { DeficiencySeverity } from '@prisma/client'
import { prismaForDbTests } from '../helpers/test-prisma.js'

const prisma = prismaForDbTests()

const sampleMetadata = {
  timestamp: '2026-04-09T12:00:00.000Z',
  gps: { latitude: 53.5461, longitude: -113.4938, accuracy: 12 },
  inspectorId: 'insp-unit-test',
  permitNumber: 'BP-2024-UNIT',
  deviceInfo: 'Vitest / Node',
}

describe('Photo Model (M7-S1)', () => {
  let userId: string | undefined
  let inspectionId: string | undefined
  let deficiencyId: string | undefined

  async function seedUserInspection() {
    const user = await prisma.user.create({
      data: {
        email: `photo-unit-${Date.now()}@example.com`,
        name: 'Photo Unit Test',
        role: 'SCO',
      },
    })
    userId = user.id
    const inspection = await prisma.permitInspection.create({
      data: {
        scheduledDate: new Date('2026-06-15'),
        status: 'IN_PROGRESS',
      },
    })
    inspectionId = inspection.id
  }

  afterEach(async () => {
    if (inspectionId) {
      await prisma.photo.deleteMany({ where: { inspectionId } })
      await prisma.deficiency.deleteMany({ where: { inspectionId } })
      await prisma.permitInspection.deleteMany({ where: { id: inspectionId } })
    }
    if (userId) {
      await prisma.user.deleteMany({ where: { id: userId } })
    }
    userId = undefined
    inspectionId = undefined
    deficiencyId = undefined
  })

  it('creates a photo with metadata and optional annotations', async () => {
    await seedUserInspection()
    const row = await prisma.photo.create({
      data: {
        clientId: `photo-cli-${Date.now()}`,
        inspectionId: inspectionId!,
        filename: 'evidence.jpg',
        mimeType: 'image/jpeg',
        size: 204800,
        metadata: sampleMetadata,
        annotations: { strokes: [{ x: 1, y: 2 }] },
        storageKey: 'r2/bucket/key/evidence.jpg',
        syncedAt: new Date('2026-04-09T13:00:00.000Z'),
      },
    })

    expect(row.storageKey).toContain('r2/')
    expect(row.metadata).toEqual(sampleMetadata)
    expect((row.annotations as { strokes: unknown[] }).strokes).toHaveLength(1)
    expect(row.syncedAt?.toISOString()).toBe('2026-04-09T13:00:00.000Z')
  })

  it('enforces unique clientId', async () => {
    await seedUserInspection()
    const clientId = `dup-photo-${Date.now()}`
    await prisma.photo.create({
      data: {
        clientId,
        inspectionId: inspectionId!,
        filename: 'a.jpg',
        mimeType: 'image/jpeg',
        size: 1,
        metadata: sampleMetadata,
      },
    })
    await expect(
      prisma.photo.create({
        data: {
          clientId,
          inspectionId: inspectionId!,
          filename: 'b.jpg',
          mimeType: 'image/jpeg',
          size: 2,
          metadata: sampleMetadata,
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' })
  })

  it('links optionally to a deficiency and clears deficiencyId when deficiency is deleted', async () => {
    await seedUserInspection()
    const def = await prisma.deficiency.create({
      data: {
        clientId: `def-for-photo-${Date.now()}`,
        inspectionId: inspectionId!,
        createdById: userId!,
        description: 'Linked deficiency for photo relation test',
        severity: DeficiencySeverity.MINOR,
      },
    })
    deficiencyId = def.id

    const photo = await prisma.photo.create({
      data: {
        clientId: `photo-def-${Date.now()}`,
        inspectionId: inspectionId!,
        deficiencyId: def.id,
        filename: 'def.jpg',
        mimeType: 'image/jpeg',
        size: 100,
        metadata: sampleMetadata,
      },
    })
    expect(photo.deficiencyId).toBe(def.id)

    await prisma.deficiency.delete({ where: { id: def.id } })
    deficiencyId = undefined

    const reloaded = await prisma.photo.findUniqueOrThrow({ where: { id: photo.id } })
    expect(reloaded.deficiencyId).toBeNull()
  })

  it('cascades delete when inspection is removed', async () => {
    await seedUserInspection()
    const created = await prisma.photo.create({
      data: {
        clientId: `photo-cascade-${Date.now()}`,
        inspectionId: inspectionId!,
        filename: 'cascade.jpg',
        mimeType: 'image/jpeg',
        size: 50,
        metadata: sampleMetadata,
      },
    })

    await prisma.permitInspection.delete({ where: { id: inspectionId! } })

    const gone = await prisma.photo.findUnique({ where: { id: created.id } })
    expect(gone).toBeNull()
  })
})
