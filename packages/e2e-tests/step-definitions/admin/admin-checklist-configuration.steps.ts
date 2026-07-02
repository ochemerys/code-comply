import { When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import type { IWorld } from '../world'

When('I open the admin checklist templates page', async function (this: IWorld) {
  await this.page.goto(`${this.getAdminUrl()}/configuration/templates`)
})

Then('I should see the checklist templates view', async function (this: IWorld) {
  await expect(this.page.getByTestId('checklist-templates-view')).toBeVisible({ timeout: 20_000 })
  await expect(this.page.getByRole('heading', { name: /checklist templates/i })).toBeVisible()
})

Then(
  'the checklist templates list should not be in a loading state',
  async function (this: IWorld) {
    await expect(this.page.getByTestId('checklist-templates-loading')).not.toBeVisible({
      timeout: 25_000,
    })
    await expect(this.page.getByTestId('checklist-templates-table')).toBeVisible()
  },
)

When('I open the admin code library page', async function (this: IWorld) {
  await this.page.goto(`${this.getAdminUrl()}/configuration/codes`)
})

Then('I should see the code library view', async function (this: IWorld) {
  await expect(this.page.getByTestId('code-library-view')).toBeVisible({ timeout: 20_000 })
  await expect(this.page.getByRole('heading', { name: /code library/i })).toBeVisible()
})

Then('the code library should not be in a loading state', async function (this: IWorld) {
  await expect(this.page.getByTestId('code-library-loading')).not.toBeVisible({ timeout: 25_000 })
  await expect(this.page.getByTestId('code-library-table')).toBeVisible()
})
