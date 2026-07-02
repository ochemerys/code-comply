import { Given, When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import type { IWorld } from '../world'

When('I open the admin portal login page', async function (this: IWorld) {
  const adminUrl = this.getAdminUrl()
  await this.page.goto(`${adminUrl}/login`)
})

Then('I should see the admin sign in form', async function (this: IWorld) {
  await expect(this.page).toHaveTitle(/Admin/)
  await expect(this.page.getByRole('heading', { name: 'Admin Portal' })).toBeVisible()
  await expect(this.page.getByLabel('Email address')).toBeVisible()
  await expect(this.page.getByLabel('Password')).toBeVisible()
  await expect(this.page.getByRole('button', { name: /sign in/i })).toBeVisible()
})
