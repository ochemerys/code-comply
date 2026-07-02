/**
 * M6-S18 — Playwright E2E steps for deficiency CRUD, checklist deep-link filter,
 * Stop Work workflow, and offline create / Stop Work (mobile viewport via @M6-S18 hooks).
 */
import { After, Before, Given, When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import type { PrismaClient } from '@prisma/client'
import type { IWorld } from './world'
import { openChecklistExecutionPage, seedChecklistWorkflow } from '../support/checklist-e2e-fixture'

/** When generated `PrismaClient` omits `photo` (stale types), cleanup can still call `photo.deleteMany`. */
type PrismaClientWithPhoto = PrismaClient & {
  photo: { deleteMany: (args?: { where?: object }) => Promise<unknown> }
}

const DEFAULT_VIEWPORT = { width: 1280, height: 720 }
const MOBILE_VIEWPORT = { width: 390, height: 844 }
const M6_S18_NOTES = 'M6-S18 E2E deficiency management'
/** Stable execution id — API miss falls back to demo template (ChecklistExecutionView). */
const M6_S18_CHECKLIST_EXEC_ID = 'm6s18-e2e-exec'

/** Per-process context (cucumber parallel: 1). */
const m6s18: { inspectionId: string | null } = { inspectionId: null }

Before({ tags: '@M6-S18' }, async function (this: IWorld) {
  if (!this.page) {
    await this.init()
  }
  await this.page.setViewportSize(MOBILE_VIEWPORT)
})

After({ tags: '@M6-S18' }, async function (this: IWorld) {
  try {
    await this.page.context().setOffline(false)
    await this.page.setViewportSize(DEFAULT_VIEWPORT)
  } catch {
    /* page/context may already be closed */
  }
})

Given(
  'M6-S18 deficiency E2E inspection is prepared for the seeded inspector',
  async function (this: IWorld) {
    const prisma = this.testDb.getClient() as PrismaClientWithPhoto
    const workflow = await seedChecklistWorkflow(prisma, `m6-s18:${M6_S18_CHECKLIST_EXEC_ID}`)
    m6s18.inspectionId = workflow.inspectionId
  },
)

When('I open the M6-S18 checklist execution page', async function (this: IWorld) {
  const id = m6s18.inspectionId
  if (!id) throw new Error('M6-S18 inspection not seeded')
  await openChecklistExecutionPage(this, `m6-s18:${M6_S18_CHECKLIST_EXEC_ID}`, MOBILE_VIEWPORT)
})

When(
  'I submit a minimal M6-S18 deficiency in the checklist fail modal with description {string} and severity {string}',
  async function (this: IWorld, description: string, severity: string) {
    const modal = this.page.getByTestId('checklist-fail-deficiency-modal')
    await expect(modal).toBeVisible({ timeout: 20000 })
    await modal.getByTestId('deficiency-description').fill(description)
    const sev = severity.toUpperCase()
    if (!['MINOR', 'MAJOR', 'CRITICAL'].includes(sev)) {
      throw new Error(`Invalid severity: ${severity}`)
    }
    await modal.getByTestId(`severity-option-${sev}`).click()
    await modal.getByTestId('deficiency-submit').click()
    await expect(modal).toBeHidden({ timeout: 30000 })
  },
)

When('I open the M6-S18 deficiency list', async function (this: IWorld) {
  const id = m6s18.inspectionId
  if (!id) throw new Error('M6-S18 inspection not seeded')
  await this.page.goto(
    `${this.getInspectorUrl()}/inspections/${encodeURIComponent(id)}/deficiencies`,
  )
  await expect(this.page.getByTestId('deficiency-list-view')).toBeVisible({ timeout: 25000 })
})

When('I start a new deficiency from the M6-S18 deficiency list', async function (this: IWorld) {
  const addBtn = this.page.getByTestId('deficiency-list-add')
  try {
    await addBtn.click({ timeout: 8000 })
  } catch {
    // Offline sync banner overlays the toolbar; force click keeps client-side routing.
    await addBtn.click({ force: true })
  }
  await expect(this.page.getByTestId('create-deficiency-view')).toBeVisible({ timeout: 20000 })
})

When(
  'I open new deficiency for M6-S18 inspection with checklist item id {string}',
  async function (this: IWorld, itemId: string) {
    const id = m6s18.inspectionId
    if (!id) throw new Error('M6-S18 inspection not seeded')
    const url = `${this.getInspectorUrl()}/inspections/${encodeURIComponent(id)}/deficiencies/new?checklistItemId=${encodeURIComponent(itemId)}`
    await this.page.goto(url)
    await expect(this.page.getByTestId('create-deficiency-view')).toBeVisible({ timeout: 25000 })
  },
)

When(
  'I open the M6-S18 deficiency list filtered by checklist item id {string}',
  async function (this: IWorld, itemId: string) {
    const id = m6s18.inspectionId
    if (!id) throw new Error('M6-S18 inspection not seeded')
    const url = `${this.getInspectorUrl()}/inspections/${encodeURIComponent(id)}/deficiencies?checklistItemId=${encodeURIComponent(itemId)}`
    await this.page.goto(url)
    await expect(this.page.getByTestId('deficiency-list-view')).toBeVisible({ timeout: 25000 })
  },
)

When(
  'I submit a minimal M6-S18 deficiency with description {string} and severity {string}',
  async function (this: IWorld, description: string, severity: string) {
    await this.page.getByTestId('deficiency-description').fill(description)
    const sev = severity.toUpperCase()
    if (!['MINOR', 'MAJOR', 'CRITICAL'].includes(sev)) {
      throw new Error(`Invalid severity: ${severity}`)
    }
    await this.page.getByTestId(`severity-option-${sev}`).click()
    await this.page.getByTestId('deficiency-submit').click()
    await expect(this.page.getByTestId('deficiency-list-view')).toBeVisible({ timeout: 30000 })
    await expect(this.page.getByTestId('deficiency-list')).toBeVisible({ timeout: 30000 })
  },
)

Then(
  'I should see the M6-S18 deficiency list with text {string}',
  async function (this: IWorld, text: string) {
    await expect(this.page.getByTestId('deficiency-list')).toContainText(text, { timeout: 20000 })
  },
)

Then('I should see the M6-S18 checklist filter banner', async function (this: IWorld) {
  await expect(this.page.getByTestId('deficiency-list-checklist-filter-banner')).toBeVisible({
    timeout: 15000,
  })
})

When('I open the first deficiency card from the M6-S18 list', async function (this: IWorld) {
  const link = this.page.locator('[data-testid^="deficiency-card-link-"]').first()
  await expect(link).toBeVisible({ timeout: 20000 })
  await link.click()
  await expect(this.page.getByTestId('deficiency-detail-view')).toBeVisible({ timeout: 20000 })
})

Then('I should see the M6-S18 deficiency detail view', async function (this: IWorld) {
  await expect(this.page.getByTestId('deficiency-detail-view')).toBeVisible()
})

When('I open edit deficiency from the M6-S18 detail view', async function (this: IWorld) {
  await this.page.getByTestId('deficiency-detail-edit').click()
  await expect(this.page.getByTestId('edit-deficiency-modal')).toBeVisible({ timeout: 15000 })
})

When(
  'I change the M6-S18 deficiency description to {string}',
  async function (this: IWorld, text: string) {
    const ta = this.page.getByTestId('deficiency-description')
    await ta.fill(text)
  },
)

When('I save the M6-S18 edit deficiency modal', async function (this: IWorld) {
  await this.page.getByTestId('deficiency-submit').click()
  await expect(this.page.getByTestId('edit-deficiency-modal')).toBeHidden({ timeout: 20000 })
})

Then(
  'I should see M6-S18 deficiency detail description {string}',
  async function (this: IWorld, text: string) {
    await expect(this.page.getByTestId('deficiency-detail-description')).toContainText(text, {
      timeout: 15000,
    })
  },
)

When('I request delete from the M6-S18 deficiency detail view', async function (this: IWorld) {
  await this.page.getByTestId('deficiency-detail-delete').click()
  await expect(this.page.getByTestId('delete-deficiency-dialog')).toBeVisible({ timeout: 15000 })
})

When('I confirm M6-S18 delete deficiency dialog', async function (this: IWorld) {
  await this.page.getByTestId('delete-deficiency-dialog-confirm').click()
  await expect(this.page.getByTestId('deficiency-list-view')).toBeVisible({ timeout: 25000 })
})

Then('I should see the M6-S18 deficiency list empty state', async function (this: IWorld) {
  await expect(this.page.getByTestId('deficiency-list-empty')).toBeVisible({ timeout: 15000 })
})

When('I request Stop Work from the M6-S18 deficiency detail view', async function (this: IWorld) {
  await this.page.getByTestId('stop-work-order-button').click()
  await expect(this.page.getByTestId('stop-work-confirm-dialog')).toBeVisible({ timeout: 15000 })
})

When('I confirm the M6-S18 Stop Work dialog', async function (this: IWorld) {
  await this.page.getByTestId('stop-work-dialog-confirm').click()
  await expect(this.page.getByTestId('stop-work-confirm-dialog')).toBeHidden({ timeout: 25000 })
})

Then('I should see M6-S18 Stop Work issued on deficiency detail', async function (this: IWorld) {
  await expect(this.page.getByTestId('deficiency-detail-stop-work')).toBeVisible({ timeout: 20000 })
})
