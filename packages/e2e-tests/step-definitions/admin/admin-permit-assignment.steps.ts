import { When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import type { IWorld } from '../world'

When('I open the admin permits page', async function (this: IWorld) {
  await this.page.goto(`${this.getAdminUrl()}/permits`)
})

Then('I should see the permit management view', async function (this: IWorld) {
  await expect(this.page.getByTestId('permits-view')).toBeVisible({ timeout: 20_000 })
  await expect(this.page.getByRole('heading', { name: /permit management/i })).toBeVisible()
})

When('I click sync permits on the admin permits page', async function (this: IWorld) {
  await this.page.getByTestId('permits-sync-button').click()
})

Then('I should see a permit sync summary on the admin permits page', async function (this: IWorld) {
  const summary = this.page.getByTestId('permits-sync-summary')
  await expect(summary).toBeVisible({ timeout: 25_000 })
  await expect(summary).toContainText(/new:|updated:|unchanged:/i)
})

When('I open the admin assignment grid page', async function (this: IWorld) {
  await this.page.goto(`${this.getAdminUrl()}/assignments/grid`)
})

Then('the assignment grid should not be in a loading state', async function (this: IWorld) {
  await expect(this.page.getByTestId('assignment-grid')).toBeVisible({ timeout: 20_000 })
  await expect(this.page.getByTestId('assignment-grid-loading')).not.toBeVisible({
    timeout: 25_000,
  })
})

When('I open the admin bulk assignment page', async function (this: IWorld) {
  await this.page.goto(`${this.getAdminUrl()}/assignments/bulk`)
})

Then('the bulk assignment should not be in a loading state', async function (this: IWorld) {
  await expect(this.page.getByTestId('bulk-assignment')).toBeVisible({ timeout: 20_000 })
  await expect(this.page.getByTestId('bulk-assignment-loading')).not.toBeVisible({
    timeout: 25_000,
  })
})
