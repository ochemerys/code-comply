import { When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import type { IWorld } from '../world'

When('I open the admin login page with access denied reason', async function (this: IWorld) {
  const adminUrl = this.getAdminUrl()
  await this.page.goto(`${adminUrl}/login?reason=access_denied`)
})

Then('I should see the admin access denied notice', async function (this: IWorld) {
  const notice = this.page.getByTestId('login-access-denied-notice')
  await expect(notice).toBeVisible()
  await expect(notice).toContainText(/administrator privileges/i)
})
