/**
 * E2E step definitions for Permit Detail View (M4-S11)
 */
import { Given, When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import type { IWorld } from '../world'
import { seedAndLoadPermitList } from '../../support/permit-list-e2e-fixture'

When('I click the first permit card', async function (this: IWorld) {
  const firstCard = this.page.locator('.permit-card').first()
  await firstCard.click()
  await this.page.waitForLoadState('networkidle')
})

Then('I should be on the permit detail page', async function (this: IWorld) {
  await expect(this.page).toHaveURL(/\/(permits\/[^/]+)$/)
})

Then('I should see the permit detail heading', async function (this: IWorld) {
  await expect(this.page.getByRole('heading', { name: /Permit details/i })).toBeVisible()
})

Then('I should see permit information section', async function (this: IWorld) {
  await expect(this.page.getByRole('heading', { name: 'Permit Information' })).toBeVisible()
})

Then('I should see scheduled inspections section', async function (this: IWorld) {
  await expect(this.page.getByRole('heading', { name: 'Scheduled Inspections' })).toBeVisible()
})

Then('I should see a {string} button', async function (this: IWorld, label: string) {
  await expect(this.page.getByRole('button', { name: new RegExp(label, 'i') })).toBeVisible()
})

Then('I should see a {string} control', async function (this: IWorld, label: string) {
  await expect(this.page.getByRole('button', { name: label })).toBeVisible()
})

When('I click the back to permits control', async function (this: IWorld) {
  await this.page.getByRole('button', { name: 'Back to Permits' }).click()
  await this.page.waitForLoadState('networkidle')
})

Then('I should be on the permits list page', async function (this: IWorld) {
  await expect(this.page).toHaveURL(/\/(permits)$/)
})

Given(
  'there are cached permits in the permit list with coordinates',
  async function (this: IWorld) {
    await seedAndLoadPermitList.call(this, 2, { withCoordinates: true })
  },
)

Then('I should see an enabled {string} button', async function (this: IWorld, label: string) {
  const btn = this.page.getByRole('button', { name: label })
  await expect(btn).toBeVisible()
  await expect(btn).toBeEnabled()
})
