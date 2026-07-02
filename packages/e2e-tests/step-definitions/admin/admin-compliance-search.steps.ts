import { When } from '@cucumber/cucumber'
import type { IWorld } from '../world'

When('I open the admin compliance search page', async function (this: IWorld) {
  const adminUrl = this.getAdminUrl()
  await this.page.goto(`${adminUrl}/compliance/search`)
})
