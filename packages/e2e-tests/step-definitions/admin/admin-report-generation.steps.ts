import { When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import type { IWorld } from '../world'

When('I open the admin reports page', async function (this: IWorld) {
  await this.page.goto(`${this.getAdminUrl()}/reports`)
})

Then('I should see the report generation view', async function (this: IWorld) {
  await expect(this.page.getByTestId('report-generation-view')).toBeVisible({ timeout: 20_000 })
})

Then('the report generator should be visible', async function (this: IWorld) {
  await expect(this.page.getByTestId('report-generator')).toBeVisible({ timeout: 20_000 })
})
