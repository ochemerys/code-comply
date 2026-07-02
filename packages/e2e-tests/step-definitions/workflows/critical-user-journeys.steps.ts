/**
 * M11-S16 — Playwright E2E steps for critical user journeys (inspector, admin, reporting, offline).
 */
import { After, Before, Given, When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import type { PrismaClient } from '@prisma/client'
import type { IWorld } from '../world'
import {
  openChecklistExecutionPage,
  seedChecklistWorkflow,
} from '../../support/checklist-e2e-fixture'

type PrismaClientWithPhoto = PrismaClient & {
  photo: { deleteMany: (args?: { where?: object }) => Promise<unknown> }
}

const M11_S16_CHECKLIST_EXEC_ID = 'm11s16-e2e-exec'
const DEFAULT_VIEWPORT = { width: 1280, height: 720 }

const VIEWPORTS: Record<string, { width: number; height: number }> = {
  desktop: { width: 1280, height: 720 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 390, height: 844 },
}

const m11s16: { inspectionId: string | null } = { inspectionId: null }

Before({ tags: '@M11-S16' }, async function (this: IWorld) {
  const browser = (process.env.E2E_BROWSER || 'chromium').toLowerCase()
  if (!['chromium', 'webkit'].includes(browser)) {
    throw new Error(`Unsupported E2E_BROWSER="${process.env.E2E_BROWSER}" (use chromium or webkit)`)
  }
})

Given('M11-S16 E2E viewport is {string}', async function (this: IWorld, name: string) {
  const size = VIEWPORTS[name.toLowerCase()]
  if (!size) {
    throw new Error(`Unknown M11-S16 viewport "${name}" (expected desktop, tablet, or mobile)`)
  }
  await this.page.setViewportSize(size)
})

After({ tags: '@M11-S16' }, async function (this: IWorld) {
  try {
    await this.page.context().setOffline(false)
    await this.page.setViewportSize(DEFAULT_VIEWPORT)
  } catch {
    /* page/context may already be closed */
  }
})

async function cleanM11S16(prisma: PrismaClientWithPhoto): Promise<void> {
  await prisma.checklistExecution.deleteMany({
    where: { inspection: { notes: { startsWith: 'E2E checklist workflow m11-s16:' } } },
  })
  await prisma.photo.deleteMany({
    where: { inspection: { notes: { startsWith: 'E2E checklist workflow m11-s16:' } } },
  })
  await prisma.deficiency.deleteMany({
    where: { inspection: { notes: { startsWith: 'E2E checklist workflow m11-s16:' } } },
  })
  await prisma.inspectionSchedule.deleteMany({
    where: { inspection: { notes: { startsWith: 'E2E checklist workflow m11-s16:' } } },
  })
  await prisma.permitInspection.deleteMany({
    where: { notes: { startsWith: 'E2E checklist workflow m11-s16:' } },
  })
}

Given('M11-S16 inspection workflow data is prepared', async function (this: IWorld) {
  const prisma = this.testDb.getClient() as PrismaClientWithPhoto
  await cleanM11S16(prisma)
  const workflow = await seedChecklistWorkflow(prisma, `m11-s16:${M11_S16_CHECKLIST_EXEC_ID}`)
  m11s16.inspectionId = workflow.inspectionId
})

When('I open the M11-S16 checklist execution page', async function (this: IWorld) {
  if (!m11s16.inspectionId) throw new Error('M11-S16 inspection not seeded')
  const size = this.page.viewportSize() ?? VIEWPORTS.desktop
  await openChecklistExecutionPage(this, `m11-s16:${M11_S16_CHECKLIST_EXEC_ID}`, size)
})

Then('I should see the M11-S16 checklist execution shell', async function (this: IWorld) {
  await expect(this.page.getByTestId('checklist-execution-view')).toBeVisible({ timeout: 25_000 })
  await expect(this.page.getByTestId('checklist-pass-item-1')).toBeVisible({ timeout: 15_000 })
})
