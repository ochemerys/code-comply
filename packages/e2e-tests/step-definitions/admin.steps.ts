import { Given, When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import type { IWorld } from './world'

Given('I am signed in as an admin', async function (this: IWorld) {
  const adminUrl = this.getAdminUrl()
  const { email, password } = this.testCredentials.admin

  await this.page.goto(`${adminUrl}/login`)

  await this.page.getByLabel('Email address').fill(email)
  await this.page.getByLabel('Password').fill(password)
  await this.page.getByRole('button', { name: /sign in/i }).click()

  await expect(this.page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({
    timeout: 25_000,
  })
})

Then('I should see the admin dashboard', async function (this: IWorld) {
  await expect(this.page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
})

Then('I should see the admin users registry shell', async function (this: IWorld) {
  await expect(this.page.getByTestId('user-list-view')).toBeVisible({ timeout: 20_000 })
  await expect(this.page.getByRole('heading', { name: 'Users' })).toBeVisible()
})

When(
  'I attempt to sign in to the admin portal using owner credentials',
  async function (this: IWorld) {
    const adminUrl = this.getAdminUrl()
    const { email, password } = this.testCredentials.owner

    await this.page.goto(`${adminUrl}/login`)

    await this.page.getByLabel('Email address').fill(email)
    await this.page.getByLabel('Password').fill(password)
    await this.page.getByRole('button', { name: /sign in/i }).click()
  },
)

Then('I should see the admin portal login denied message', async function (this: IWorld) {
  await expect(this.page.getByRole('heading', { name: 'Admin Portal' })).toBeVisible({
    timeout: 15_000,
  })
  await expect(this.page.getByRole('heading', { name: 'Dashboard' })).toHaveCount(0)
  await expect(this.page.getByText(/admin privileges required/i)).toBeVisible()
})

When('I open the user detail page for the seeded inspector', async function (this: IWorld) {
  const row = await this.testDb.getClient().user.findUnique({
    where: { email: this.testCredentials.inspector.email },
    select: { id: true },
  })
  if (!row?.id) {
    throw new Error(`Seeded inspector not found (${this.testCredentials.inspector.email})`)
  }

  await this.page.goto(`${this.getAdminUrl()}/users/${row.id}`)

  await expect(this.page.getByTestId('user-detail-view')).toBeVisible({ timeout: 20_000 })
  await expect(this.page.getByTestId('user-detail-loading')).not.toBeVisible({ timeout: 20_000 })
})

Then('I should see the certifications editor', async function (this: IWorld) {
  await expect(this.page.getByTestId('user-detail-certifications')).toBeVisible()
  await expect(this.page.getByTestId('certification-editor')).toBeVisible()
})

When('I persist certifications from the user detail page', async function (this: IWorld) {
  const editor = this.page.getByTestId('certification-editor')

  await expect(editor).toBeVisible({ timeout: 10_000 })

  let disciplineCell = this.page.getByTestId('cert-discipline-0')

  if ((await disciplineCell.count()) === 0) {
    await this.page.getByTestId('certification-add').click()
    disciplineCell = this.page.getByTestId('cert-discipline-0')
  }

  await expect(disciplineCell.first()).toBeVisible({ timeout: 10_000 })

  await this.page.getByTestId('cert-discipline-0').first().fill('Building (E2E)')
  await this.page.getByTestId('cert-authority-0').first().fill('E2E Test Authority')

  const issuedCell = this.page.getByTestId('cert-issued-0').first()
  const issuedVal = await issuedCell.inputValue()
  if (!issuedVal.trim()) {
    await issuedCell.fill('2024-01-15T10:00:00.000Z')
  }

  const saveCerts = this.page.getByTestId('user-detail-save-certs')

  await expect(saveCerts).toBeEnabled()
  await saveCerts.click()

  await expect(saveCerts).toBeEnabled({ timeout: 25_000 })
})

Then('there should be no error on the user detail page', async function (this: IWorld) {
  await expect(this.page.getByTestId('user-detail-error')).not.toBeVisible()
})

When('I sign out from the admin portal using the header menu', async function (this: IWorld) {
  await this.page.getByTestId('user-menu-trigger').click()
  await expect(this.page.getByTestId('user-menu-dropdown')).toBeVisible()
  await this.page.getByTestId('user-menu-sign-out').click()
})

Then('I should see the admin assignment grid shell', async function (this: IWorld) {
  await expect(this.page.getByTestId('assignment-grid-view')).toBeVisible({ timeout: 20_000 })
  await expect(this.page.getByRole('heading', { name: /assignment grid/i })).toBeVisible()
})

Then('I should see the workload calendar shell', async function (this: IWorld) {
  await expect(this.page.getByTestId('workload-calendar-view')).toBeVisible({ timeout: 20_000 })
  await expect(this.page.getByRole('heading', { name: /workload calendar/i })).toBeVisible()
})

Then(
  'I should see the inspection monitor shell with last updated metadata',
  async function (this: IWorld) {
    await expect(this.page.getByTestId('inspection-monitor-view')).toBeVisible({ timeout: 20_000 })
    await expect(this.page.getByText(/live status/i)).toBeVisible()
    await expect(this.page.getByTestId('inspection-monitor-last-updated')).toBeVisible()
    await expect(this.page.getByTestId('inspection-monitor-refresh')).toBeVisible()
  },
)

Then('I should see the bulk assignment planner shell', async function (this: IWorld) {
  await expect(this.page.getByTestId('bulk-assignment-view')).toBeVisible({ timeout: 20_000 })
  await expect(this.page.getByRole('heading', { name: /bulk assignment/i })).toBeVisible()
})
