/**
 * E2E step definitions for Permit List View (M4-S10)
 */
import { Given, When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import type { IWorld } from '../world'
import {
  seedAndLoadPermitList,
  expandPermitsToolsPanel,
  scrollToPermitListSection,
} from '../../support/permit-list-e2e-fixture'

When('I scroll to the permit list section', async function (this: IWorld) {
  await scrollToPermitListSection(this.page)
})

Then(
  'I should see the permit list heading {string}',
  async function (this: IWorld, heading: string) {
    await expect(this.page.getByRole('heading', { name: heading, level: 2 })).toBeVisible()
  },
)

Then('I should see the status filter', async function (this: IWorld) {
  await expandPermitsToolsPanel(this.page)
  const panel = this.page.locator('#permits-tools-panel')
  await expect(panel.getByLabel('Filter by permit status')).toBeVisible()
})

Then('I should see the sort by control', async function (this: IWorld) {
  await expandPermitsToolsPanel(this.page)
  const panel = this.page.locator('#permits-tools-panel')
  await expect(panel.getByLabel('Sort permits', { exact: true })).toBeVisible()
})

Then('I should see the empty state {string}', async function (this: IWorld, text: string) {
  await expect(this.page.getByTestId('permit-list-empty')).toBeVisible()
  await expect(this.page.getByText(text)).toBeVisible()
})

Given('there are cached permits in the permit list', async function (this: IWorld) {
  await seedAndLoadPermitList.call(this, 3)
})

Then('I should see at least one permit card', async function (this: IWorld) {
  await expect(this.page.getByTestId('permit-list-cards')).toBeVisible()
  const cards = this.page.locator('.permit-card')
  await expect(cards.first()).toBeVisible({ timeout: 5000 })
})

Then('each permit card should show permit number and address', async function (this: IWorld) {
  const cards = this.page.locator('.permit-card')
  const count = await cards.count()
  expect(count).toBeGreaterThan(0)
  for (let i = 0; i < count; i++) {
    const card = cards.nth(i)
    const permitNumber = card.locator('h3')
    await expect(permitNumber).toBeVisible()
    await expect(permitNumber).not.toHaveText('')
    const address = card.locator('h3 + p')
    await expect(address).toBeVisible()
    await expect(address).not.toHaveText('')
  }
})
