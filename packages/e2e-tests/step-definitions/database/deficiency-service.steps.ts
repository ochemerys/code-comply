/**
 * M6-S3: DeficiencyService BDD steps (real DB + domain service).
 */
import { Given, When, Then, Before } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import {
  DeficiencyService,
  deficiencyNotificationHooks,
} from '../../../../apps/api/src/services/deficiency.service.js'

/** When generated `PrismaClient` omits `photo`, cleanup can still call `photo.deleteMany`. */
type PrismaClientWithPhoto = PrismaClient & {
  photo: { deleteMany: (args?: { where?: object }) => Promise<unknown> }
}

const prisma = new PrismaClient() as PrismaClientWithPhoto
const service = new DeficiencyService()

interface Ctx {
  userId?: string
  inspectionId?: string
  clientId?: string
  deficiencyId?: string
  notifyCalls?: number
}

const ctx: Ctx = {}

Before(function () {
  Object.keys(ctx).forEach((k) => delete ctx[k as keyof Ctx])
})

Given('deficiency service E2E data is prepared', async function () {
  await prisma.photo.deleteMany({
    where: { inspection: { notes: 'M6-E2E deficiency service' } },
  })
  await prisma.deficiency.deleteMany({
    where: { inspection: { notes: 'M6-E2E deficiency service' } },
  })
  await prisma.inspectionSchedule.deleteMany({
    where: { inspection: { notes: 'M6-E2E deficiency service' } },
  })
  await prisma.permitInspection.deleteMany({
    where: { notes: 'M6-E2E deficiency service' },
  })
  await prisma.user.deleteMany({
    where: { email: { contains: 'm6-e2e-def-svc' } },
  })

  const user = await prisma.user.create({
    data: {
      email: `m6-e2e-def-svc-${Date.now()}@example.com`,
      name: 'M6 E2E Def Svc',
      role: 'SCO',
    },
  })
  ctx.userId = user.id

  const inspection = await prisma.permitInspection.create({
    data: {
      scheduledDate: new Date('2026-08-01'),
      status: 'IN_PROGRESS',
      notes: 'M6-E2E deficiency service',
    },
  })
  ctx.inspectionId = inspection.id

  await prisma.inspectionSchedule.create({
    data: {
      inspectionId: inspection.id,
      assignedToId: user.id,
    },
  })

  ctx.clientId = `m6-e2e-client-${Date.now()}`
})

When('I create the same deficiency twice via DeficiencyService', async function () {
  const dto = {
    clientId: ctx.clientId!,
    inspectionId: ctx.inspectionId!,
    description: 'Duplicate clientId scenario description long enough',
    severity: 'MAJOR' as const,
    isStopWork: false,
    isUnsafe: false,
  }
  const first = await service.create(dto, ctx.userId!)
  const second = await service.create(dto, ctx.userId!)
  ctx.deficiencyId = first.id
  expect(second.id).toBe(first.id)
})

Then('only one deficiency row should exist for that clientId', async function () {
  const rows = await prisma.deficiency.findMany({ where: { clientId: ctx.clientId! } })
  expect(rows).toHaveLength(1)
  expect(rows[0].id).toBe(ctx.deficiencyId)
})

When('I issue a Stop Work order via DeficiencyService', async function () {
  let calls = 0
  const prev = deficiencyNotificationHooks.onStopWorkOrderIssued
  deficiencyNotificationHooks.onStopWorkOrderIssued = async () => {
    calls += 1
  }
  try {
    const row = await service.create(
      {
        clientId: `${ctx.clientId}-sw`,
        inspectionId: ctx.inspectionId!,
        description: 'Stop work hook scenario needs ten chars',
        severity: 'MAJOR',
        isStopWork: false,
        isUnsafe: false,
      },
      ctx.userId!,
    )
    ctx.deficiencyId = row.id
    await service.createStopWorkOrder(row.id, ctx.userId!)
    ctx.notifyCalls = calls
  } finally {
    deficiencyNotificationHooks.onStopWorkOrderIssued = prev
  }
})

Then('the deficiency should be flagged Stop Work', async function () {
  const row = await prisma.deficiency.findUniqueOrThrow({ where: { id: ctx.deficiencyId! } })
  expect(row.isStopWork).toBe(true)
})

Then('the Stop Work notification hook should have been invoked', function () {
  expect(ctx.notifyCalls).toBeGreaterThanOrEqual(1)
})
