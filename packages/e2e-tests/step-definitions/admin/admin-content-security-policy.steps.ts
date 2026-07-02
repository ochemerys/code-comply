import { When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import type { IWorld } from '../world'

let adminIndexHtml = ''
let adminCspContent = ''

function extractAdminCsp(): string {
  const metaMatch = adminIndexHtml.match(
    /<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]*)"/i,
  )
  expect(metaMatch, 'CSP meta tag missing from admin index').toBeTruthy()
  adminCspContent = metaMatch![1] ?? ''
  return adminCspContent
}

When('I request the admin portal index document', async function (this: IWorld) {
  const response = await this.page.request.get(this.getAdminUrl())
  expect(response.ok()).toBeTruthy()
  adminIndexHtml = await response.text()
})

Then('the admin index should include an enforcing Content-Security-Policy meta tag', function () {
  const content = extractAdminCsp()
  expect(content.length).toBeGreaterThan(0)
  expect(adminIndexHtml).not.toMatch(/Content-Security-Policy-Report-Only/i)
})

Then('the admin CSP should include default-src self', function () {
  expect(extractAdminCsp()).toContain("default-src 'self'")
})

Then('the admin CSP should include script-src self', function () {
  const scriptSrc = extractAdminCsp().match(/script-src[^;]+/)?.[0] ?? ''
  expect(scriptSrc).toContain("script-src 'self'")
})

Then('the admin CSP should restrict style sources', function () {
  expect(extractAdminCsp()).toContain("style-src 'self'")
})

Then('the admin CSP should restrict image sources', function () {
  expect(extractAdminCsp()).toContain("img-src 'self'")
})

Then(
  'the admin CSP should deny frame embedding via HTTP header policy',
  async function (this: IWorld) {
    const response = await this.page.request.get(this.getAdminUrl())
    const header = response.headers()['content-security-policy'] ?? ''
    expect(header).toContain("frame-ancestors 'none'")
  },
)

Then('the admin CSP should deny object embeds', function () {
  expect(extractAdminCsp()).toContain("object-src 'none'")
})

Then('the admin CSP connect-src should include the configured API URL', function (this: IWorld) {
  const apiUrl = this.getApiUrl()
  expect(extractAdminCsp()).toContain(apiUrl)
})
