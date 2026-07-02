/**
 * M8-S8: AuditLogService BDD steps (real DB).
 */
import { Given, When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import {
  auditLogService,
  AUDIT_ACTION,
  AUDIT_ENTITY,
} from '../../../../apps/api/src/services/audit-log.service.js'

const prisma = new PrismaClient()

interface Ctx {
  inspectionId?: string
  userId?: string
  permitId?: string
  lastAction?: string
}

const ctx: Ctx = {}

Given('audit log E2E seed data is prepared', async function () {
  const user = await prisma.user.create({
    data: {
      email: `m8-s8-audit-e2e-${Date.now()}@example.com`,
      name: 'Audit E2E',
      role: 'SCO',
    },
  })
  ctx.userId = user.id

  const permit = await prisma.permit.create({
    data: {
      permitNumber: `M8-S8-E2E-${Date.now()}`,
      address: '1 Audit Row',
      scope: 'E2E',
    },
  })

  const inspection = await prisma.permitInspection.create({
    data: {
      permitId: permit.id,
      scheduledDate: new Date('2026-09-01'),
      status: 'SCHEDULED',
      notes: 'audit e2e',
    },
  })
  ctx.inspectionId = inspection.id

  await prisma.inspectionSchedule.create({
    data: {
      inspectionId: inspection.id,
      assignedToId: user.id,
    },
  })

  ctx.permitId = permit.id
})

When('I append an audit entry for the seeded inspection', async function () {
  const inspectionId = ctx.inspectionId!
  const userId = ctx.userId!
  ctx.lastAction = AUDIT_ACTION.INSPECTION_CREATED

  await auditLogService.append({
    entityType: AUDIT_ENTITY.PERMIT_INSPECTION,
    entityId: inspectionId,
    action: AUDIT_ACTION.INSPECTION_CREATED,
    userId,
    afterData: { e2e: true },
  })
})

Then('listing logs for that inspection includes the new action', async function () {
  const logs = await auditLogService.listForEntity(
    AUDIT_ENTITY.PERMIT_INSPECTION,
    ctx.inspectionId!,
  )
  expect(logs.some((l) => l.action === ctx.lastAction)).toBe(true)

  const inspectionId = ctx.inspectionId!
  const permitId = ctx.permitId

  // audit_logs is append-only (cannot DELETE); leave rows for this inspection in non-prod DBs
  await prisma.inspectionSchedule.deleteMany({ where: { inspectionId } })
  await prisma.permitInspection.deleteMany({ where: { id: inspectionId } })
  if (permitId) {
    await prisma.permit.deleteMany({ where: { id: permitId } })
  }
  if (ctx.userId) {
    await prisma.user.deleteMany({ where: { id: ctx.userId } })
  }
})
