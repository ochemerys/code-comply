/**
 * Step definitions: Photo database schema E2E (M7-S1)
 */

import { Given, When, Then, Before } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import { PrismaClient, DeficiencySeverity } from '@prisma/client'

/** Fields read from `prisma.photo` in these steps; avoids missing `PrismaClient.photo` in some TS resolutions. */
type PhotoSchemaRow = {
  id: string
  mimeType: string
  metadata: unknown
  deficiencyId: string | null
}

type PrismaClientWithPhoto = PrismaClient & {
  photo: {
    deleteMany: (args?: { where?: object }) => Promise<unknown>
    create: (args: object) => Promise<PhotoSchemaRow>
    findUniqueOrThrow: (args: object) => Promise<PhotoSchemaRow>
  }
}

const prisma = new PrismaClient() as PrismaClientWithPhoto

interface PhotoWorld {
  userId?: string
  inspectionId?: string
  photoId?: string
  deficiencyId?: string
}

const w: PhotoWorld = {}

Before(function () {
  Object.keys(w).forEach((k) => delete w[k as keyof PhotoWorld])
})

Given('the photo schema test database is prepared', async function () {
  const existing = await prisma.permitInspection.findMany({
    where: { notes: 'M7-E2E photo schema' },
    select: { id: true },
  })
  const inspectionIds = existing.map((r) => r.id)
  if (inspectionIds.length > 0) {
    await prisma.photo.deleteMany({ where: { inspectionId: { in: inspectionIds } } })
    await prisma.deficiency.deleteMany({ where: { inspectionId: { in: inspectionIds } } })
    await prisma.inspectionSchedule.deleteMany({
      where: { inspectionId: { in: inspectionIds } },
    })
    await prisma.permitInspection.deleteMany({ where: { id: { in: inspectionIds } } })
  }
  await prisma.user.deleteMany({
    where: { email: { contains: 'm7-e2e-photo-schema' } },
  })

  const user = await prisma.user.create({
    data: {
      email: `m7-e2e-photo-schema-${Date.now()}@example.com`,
      name: 'M7 E2E Photo',
      role: 'SCO',
    },
  })
  w.userId = user.id
  const inspection = await prisma.permitInspection.create({
    data: {
      scheduledDate: new Date('2026-06-20'),
      status: 'IN_PROGRESS',
      notes: 'M7-E2E photo schema',
    },
  })
  w.inspectionId = inspection.id
})

When(
  'I create a photo with filename {string} and pending upload',
  async function (filename: string) {
    const row = await prisma.photo.create({
      data: {
        clientId: `m7-e2e-${Date.now()}`,
        inspectionId: w.inspectionId!,
        filename,
        mimeType: 'image/jpeg',
        size: 345678,
        storageKey: null,
        metadata: {
          timestamp: new Date().toISOString(),
          gps: { latitude: 53.54, longitude: -113.49, accuracy: 8 },
          inspectorId: w.userId!,
          permitNumber: 'BP-E2E-M7',
          deviceInfo: 'Cucumber E2E',
        },
      },
    })
    w.photoId = row.id
  },
)

Then('the photo should have mime type {string}', async function (mime: string) {
  const row = await prisma.photo.findUniqueOrThrow({ where: { id: w.photoId! } })
  expect(row.mimeType).toBe(mime)
})

Then('the photo metadata should include permit number {string}', async function (permit: string) {
  const row = await prisma.photo.findUniqueOrThrow({ where: { id: w.photoId! } })
  const meta = row.metadata as { permitNumber?: string }
  expect(meta.permitNumber).toBe(permit)
})

When('I create a deficiency and a photo linked to it', async function () {
  const def = await prisma.deficiency.create({
    data: {
      clientId: `m7-e2e-def-${Date.now()}`,
      inspectionId: w.inspectionId!,
      createdById: w.userId!,
      description: 'M7 E2E deficiency for photo link',
      severity: DeficiencySeverity.MAJOR,
    },
  })
  w.deficiencyId = def.id

  const row = await prisma.photo.create({
    data: {
      clientId: `m7-e2e-photo-def-${Date.now()}`,
      inspectionId: w.inspectionId!,
      deficiencyId: def.id,
      filename: 'linked.jpg',
      mimeType: 'image/jpeg',
      size: 111,
      metadata: {
        timestamp: new Date().toISOString(),
        gps: { latitude: 0, longitude: 0, accuracy: 0 },
        inspectorId: w.userId!,
        permitNumber: 'BP-LINK',
        deviceInfo: 'E2E',
      },
    },
  })
  w.photoId = row.id
})

Then('the photo should reference that deficiency', async function () {
  const row = await prisma.photo.findUniqueOrThrow({ where: { id: w.photoId! } })
  expect(row.deficiencyId).toBe(w.deficiencyId)
})
