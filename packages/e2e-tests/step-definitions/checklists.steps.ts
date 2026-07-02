/**
 * M5-S18 — Checklist execution E2E (Inspector PWA).
 * Mobile-first viewport; uses data-testid hooks from ChecklistExecutionView.
 */

import { After, Given, When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import type { IWorld } from './world'
import { openChecklistExecutionPage } from '../support/checklist-e2e-fixture'

const DEFAULT_VIEWPORT = { width: 1280, height: 720 }
const MOBILE_VIEWPORT = { width: 390, height: 844 }

After({ tags: '@M5-S18' }, async function (this: IWorld) {
  if (!this.page) return
  try {
    const ctx = this.page.context()
    await ctx.setOffline(false)
    await this.page.setViewportSize(DEFAULT_VIEWPORT)
  } catch {
    /* context may already be closed if teardown ran first */
  }
})

Given(
  'I have opened the checklist execution page for inspection {string} and execution {string}',
  async function (this: IWorld, inspectionId: string, executionId: string) {
    await openChecklistExecutionPage(this, `${inspectionId}:${executionId}`)
  },
)

When('I mark each checklist item as Pass using the item buttons', async function (this: IWorld) {
  for (const id of ['item-1', 'item-2', 'item-3', 'item-4']) {
    await this.page.getByTestId(`checklist-pass-${id}`).click()
    await expect(this.page.getByTestId(`checklist-item-status-${id}`)).toContainText('PASS', {
      timeout: 10_000,
    })
  }
})

When(
  'I mark checklist item {string} as Pass using its Pass button',
  async function (this: IWorld, itemId: string) {
    await this.page.getByTestId(`checklist-pass-${itemId}`).click()
  },
)

When(
  'I mark checklist item {string} as Fail choosing the first code search hit for {string}',
  async function (this: IWorld, itemId: string, searchQuery: string) {
    await this.page.getByTestId(`checklist-fail-${itemId}`).click()
    await expect(this.page.getByTestId('code-reference-modal')).toBeVisible()
    const input = this.page.getByTestId('code-reference-search-input')
    await input.fill(searchQuery)
    await expect(this.page.getByTestId('code-reference-results-list')).toBeVisible({
      timeout: 15000,
    })
    await this.page.getByTestId('code-reference-results-list').locator('button').first().click()
    await expect(this.page.getByTestId('code-reference-modal')).toBeHidden({ timeout: 10000 })
    await expect(this.page.getByTestId(`checklist-item-status-${itemId}`)).toContainText('FAIL', {
      timeout: 10_000,
    })
    await expect(this.page.getByTestId('checklist-save-status')).toContainText('Saved locally', {
      timeout: 15_000,
    })
  },
)

When(
  'I open the record deficiency form for checklist item {string}',
  async function (this: IWorld, itemId: string) {
    await this.page.getByTestId(`checklist-record-deficiency-${itemId}`).click()
    await expect(this.page.getByTestId('checklist-fail-deficiency-modal')).toBeVisible({
      timeout: 15000,
    })
  },
)

When('I confirm Pass all on the checklist', async function (this: IWorld) {
  await this.page.getByTestId('checklist-pass-all').click()
  await expect(this.page.getByTestId('pass-all-dialog')).toBeVisible()
  await this.page.getByTestId('pass-all-dialog-confirm').click()
  await expect(this.page.getByTestId('pass-all-dialog')).toBeHidden({ timeout: 10000 })
})

When('I set the checklist filter to failed only', async function (this: IWorld) {
  await this.page.getByTestId('checklist-filter-failed').click()
})

When('the inspector browser goes offline', async function (this: IWorld) {
  await this.page.context().setOffline(true)
  await this.page.evaluate(() => {
    window.dispatchEvent(new Event('offline'))
  })
})

Then(
  'the checklist progress percentage should be {int}',
  async function (this: IWorld, pct: number) {
    await expect(this.page.getByTestId('checklist-progress-percent')).toContainText(`${pct}%`)
  },
)

Then(
  'checklist item {string} should show FAIL with a code reference',
  async function (this: IWorld, itemId: string) {
    await expect(this.page.getByTestId(`checklist-item-status-${itemId}`)).toContainText('FAIL')
    await expect(this.page.getByTestId(`checklist-item-code-ref-${itemId}`)).toBeVisible()
  },
)

Then('only failed checklist items are visible in the list', async function (this: IWorld) {
  const articles = this.page.locator('[data-testid^="checklist-item-item-"]')
  await expect(articles).toHaveCount(1)
})

Then('checklist item {string} should be visible', async function (this: IWorld, itemId: string) {
  await expect(this.page.getByTestId(`checklist-item-${itemId}`)).toBeVisible()
})

Then(
  'checklist item {string} should not be visible',
  async function (this: IWorld, itemId: string) {
    await expect(this.page.locator(`[data-testid="checklist-item-${itemId}"]`)).toHaveCount(0)
  },
)

Then('the checklist footer should indicate offline saved state', async function (this: IWorld) {
  const footer = this.page.getByTestId('checklist-save-status')
  await expect(footer).toContainText('Offline')
  await expect(footer).toContainText('Saved locally')
})
