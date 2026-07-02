import { When } from '@cucumber/cucumber'
import type { IWorld } from '../world'

When('I open the admin inspection monitor page', async function (this: IWorld) {
  const adminUrl = this.getAdminUrl()
  await this.page.goto(`${adminUrl}/inspections/monitor`)
})
