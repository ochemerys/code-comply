import { When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import type { IWorld } from '../world'

When('I open the admin Stop Work orders page', async function (this: IWorld) {
  await this.page.goto(`${this.getAdminUrl()}/orders`)
})

Then('I should see the Stop Work orders view', async function (this: IWorld) {
  await expect(this.page.getByTestId('orders-list-view')).toBeVisible({ timeout: 20_000 })
  await expect(this.page.getByRole('heading', { name: /stop work orders/i })).toBeVisible()
})

Then('the orders list should not be in a loading state', async function (this: IWorld) {
  await expect(this.page.getByTestId('orders-loading')).not.toBeVisible({ timeout: 25_000 })
})
