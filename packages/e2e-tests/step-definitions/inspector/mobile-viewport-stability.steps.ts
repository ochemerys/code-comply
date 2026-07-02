import { After, Given, When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import { devices } from 'playwright'
import type { IWorld } from '../world'

const ADDRESS_BAR_COLLAPSE_DELTA_PX = 64
const P3_BOTTOM_NAV_TOLERANCE_PX = 1

let expandedViewport: { width: number; height: number } | null = null

Given('the P3 mobile viewport is {string}', async function (this: IWorld, deviceName: string) {
  const descriptor = devices[deviceName]
  if (!descriptor?.viewport) {
    throw new Error(`Unknown Playwright mobile device "${deviceName}"`)
  }

  if (this.context) {
    await this.context.close()
  }

  this.context = await this.browser.newContext({ ...descriptor })
  this.page = await this.context.newPage()

  expandedViewport = descriptor.viewport
  await this.page.setViewportSize({
    width: descriptor.viewport.width,
    height: descriptor.viewport.height - ADDRESS_BAR_COLLAPSE_DELTA_PX,
  })
})

When('I open the P3 viewport stability page {string}', async function (this: IWorld, path: string) {
  await this.page.goto(`${this.getInspectorUrl()}${path}`, { waitUntil: 'domcontentloaded' })
  await expect(this.page.getByTestId('bottom-nav')).toBeVisible({ timeout: 15_000 })
})

When('I scroll until the mobile browser chrome would collapse', async function (this: IWorld) {
  await this.page.evaluate(() => {
    const candidates = [
      document.scrollingElement,
      document.querySelector('main'),
      document.querySelector('#app'),
    ].filter((element): element is Element => element != null)

    const scrollable = candidates.find((element) => element.scrollHeight > element.clientHeight)
    if (scrollable) {
      scrollable.scrollTop = scrollable.scrollHeight
    }
    window.scrollTo(0, document.documentElement.scrollHeight)
  })

  if (!expandedViewport) {
    throw new Error('P3 expanded viewport was not configured')
  }
  await this.page.setViewportSize(expandedViewport)
})

Then(
  'the P3 bottom navigation should be flush with the viewport bottom',
  async function (this: IWorld) {
    const bottomOffset = await this.page.getByTestId('bottom-nav').evaluate((element: Element) => {
      const rect = element.getBoundingClientRect()
      return Math.abs(rect.bottom - window.innerHeight)
    })

    expect(bottomOffset).toBeLessThanOrEqual(P3_BOTTOM_NAV_TOLERANCE_PX)
  },
)

After({ tags: '@P3-dvh' }, async function () {
  expandedViewport = null
})
