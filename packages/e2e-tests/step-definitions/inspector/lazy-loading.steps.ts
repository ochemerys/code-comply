import { When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import type { IWorld } from '../world'

When('I open the inspector user manual page', async function (this: IWorld) {
  const inspectorUrl = this.getInspectorUrl()
  await this.page.goto(`${inspectorUrl}/user-manual`)
})

Then('I should see the inspector user manual content', async function (this: IWorld) {
  await expect(this.page.getByRole('heading', { name: /Inspector App — User Guide/i })).toBeVisible(
    {
      timeout: 15_000,
    },
  )
})

When('I open the inspector login page', async function (this: IWorld) {
  const inspectorUrl = this.getInspectorUrl()
  await this.page.goto(`${inspectorUrl}/login`)
})

Then('I should see the inspector sign in form', async function (this: IWorld) {
  await expect(this.page.locator('.max-w-md h1').first()).toContainText('Safety Codes Inspector')
  await expect(this.page.getByText(/Sign in to your account/i)).toBeVisible()
})
