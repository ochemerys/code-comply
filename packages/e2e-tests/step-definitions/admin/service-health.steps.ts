/**
 * Shared health checks for admin feature Backgrounds.
 * Defined under step-definitions/admin so Cucumber language tooling resolves steps for admin/*.feature reliably.
 */
import { Given } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import type { IWorld } from '../world'

Given('the API is running', async function (this: IWorld) {
  const apiUrl = this.getApiUrl()
  const response = await this.page.request.get(`${apiUrl}/health`)
  expect(response.ok()).toBeTruthy()
})

Given('the admin app is running', async function (this: IWorld) {
  const adminUrl = this.getAdminUrl()
  const response = await this.page.request.get(adminUrl)
  expect(response.ok()).toBeTruthy()
})
