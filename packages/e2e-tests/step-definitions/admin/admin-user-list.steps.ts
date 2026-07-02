import { When } from '@cucumber/cucumber'
import type { IWorld } from '../world'

When('I open the admin users page', async function (this: IWorld) {
  const adminUrl = this.getAdminUrl()
  await this.page.goto(`${adminUrl}/users`)
})
