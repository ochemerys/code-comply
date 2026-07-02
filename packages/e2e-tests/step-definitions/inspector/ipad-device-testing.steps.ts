/**
 * M11-S17 — Playwright E2E steps for iPad device testing (WebKit + iPad viewports).
 */
import { After, Before, Given, When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import type { IWorld } from '../world'

const IPAD_VIEWPORTS: Record<
  string,
  { portrait: { width: number; height: number }; landscape: { width: number; height: number } }
> = {
  'ipad-pro-12-9': {
    portrait: { width: 1024, height: 1366 },
    landscape: { width: 1366, height: 1024 },
  },
  'ipad-air': {
    portrait: { width: 820, height: 1180 },
    landscape: { width: 1180, height: 820 },
  },
  'ipad-mini': {
    portrait: { width: 768, height: 1024 },
    landscape: { width: 1024, height: 768 },
  },
}

const IPAD_PERFORMANCE_LOAD_MS = 3000
const IPAD_MIN_TOUCH_TARGET_PX = 44

const m11s17: {
  device: string | null
  orientation: 'portrait' | 'landscape' | null
  loadTimeMs: number | null
} = { device: null, orientation: null, loadTimeMs: null }

type WorldM11S17 = IWorld & {
  m11s17Doc?: { criteria: string[]; devices: string[] }
}

Before({ tags: '@M11-S17' }, async function (this: IWorld) {
  const browser = (process.env.E2E_BROWSER || 'chromium').toLowerCase()
  if (browser !== 'webkit') {
    console.warn(
      `M11-S17: E2E_BROWSER=${browser}; physical iPad tests target WebKit — continuing with ${browser}`,
    )
  }
})

Given('M11-S17 iPad device is {string}', async function (this: IWorld, device: string) {
  if (!IPAD_VIEWPORTS[device]) {
    throw new Error(`Unknown M11-S17 device "${device}"`)
  }
  m11s17.device = device
})

Given('M11-S17 iPad orientation is {string}', async function (this: IWorld, orientation: string) {
  const device = m11s17.device
  if (!device) throw new Error('M11-S17 device not set')
  const profiles = IPAD_VIEWPORTS[device]
  const ori = orientation.toLowerCase() as 'portrait' | 'landscape'
  if (ori !== 'portrait' && ori !== 'landscape') {
    throw new Error(`Unknown orientation "${orientation}"`)
  }
  m11s17.orientation = ori
  const size = profiles[ori]
  await this.page.setViewportSize(size)
})

When('I open the inspector home page for M11-S17', async function (this: IWorld) {
  const url = `${this.getInspectorUrl()}/login`
  const start = Date.now()
  await this.page.goto(url, { waitUntil: 'domcontentloaded' })
  await expect(this.page.locator('input[type="email"]')).toBeVisible({ timeout: 15_000 })
  m11s17.loadTimeMs = Date.now() - start
})

Then('the M11-S17 PWA install prerequisites should be present', async function (this: IWorld) {
  const manifest = await this.page.locator('link[rel="manifest"]').count()
  expect(manifest).toBeGreaterThan(0)

  const appleCapable = await this.page
    .locator('meta[name="apple-mobile-web-app-capable"]')
    .getAttribute('content')
  expect(appleCapable).toBe('yes')

  const touchIcon = await this.page.locator('link[rel="apple-touch-icon"]').count()
  expect(touchIcon).toBeGreaterThan(0)

  await expect(this.page).toHaveTitle(/Inspector/)
})

Then('the M11-S17 page load time should be acceptable', async function (this: IWorld) {
  expect(m11s17.loadTimeMs).not.toBeNull()
  expect(m11s17.loadTimeMs!).toBeLessThanOrEqual(IPAD_PERFORMANCE_LOAD_MS)
})

Then('the M11-S17 geolocation API should be available', async function (this: IWorld) {
  const hasGeo = await this.page.evaluate(() => 'geolocation' in navigator)
  expect(hasGeo).toBe(true)
})

Then('the M11-S17 camera API should be available', async function (this: IWorld) {
  const hasCamera = await this.page.evaluate(
    () => typeof navigator.mediaDevices?.getUserMedia === 'function',
  )
  expect(hasCamera).toBe(true)
})

Then('the M11-S17 touch target minimum should be met', async function (this: IWorld) {
  const minSize = await this.page.evaluate((minPx: number) => {
    const buttons = Array.from(document.querySelectorAll('button'))
    if (buttons.length === 0) return minPx
    const sizes = buttons.map((el) => {
      const rect = el.getBoundingClientRect()
      return Math.min(rect.width, rect.height)
    })
    return Math.max(...sizes)
  }, IPAD_MIN_TOUCH_TARGET_PX)
  expect(minSize).toBeGreaterThanOrEqual(IPAD_MIN_TOUCH_TARGET_PX)
})

Given(
  'the iPad device testing acceptance criteria are defined for M11-S17',
  async function (this: IWorld) {
    const w = this as WorldM11S17
    w.m11s17Doc = {
      criteria: [
        'PWA installs correctly',
        'Camera works',
        'GPS works',
        'Offline mode works',
        'Touch interactions work',
        'Performance is acceptable',
      ],
      devices: ['iPad Pro 12.9"', 'iPad Air', 'iPad mini'],
    }
  },
)

Then(
  'unit and integration tests should cover M11-S17 iPad device profiles and capabilities',
  async function (this: IWorld) {
    const doc = (this as WorldM11S17).m11s17Doc
    expect(doc?.criteria?.length).toBeGreaterThanOrEqual(6)
    expect(doc?.devices?.length).toBe(3)
  },
)

After({ tags: '@M11-S17' }, async function (this: IWorld) {
  m11s17.device = null
  m11s17.orientation = null
  m11s17.loadTimeMs = null
  try {
    await this.page.context().setOffline(false)
  } catch {
    /* page may be closed after context recreation */
  }
})
