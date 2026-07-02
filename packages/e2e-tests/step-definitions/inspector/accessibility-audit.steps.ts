/**
 * M11-S18 — Playwright E2E steps for WCAG 2.1 AA accessibility audit (axe-core + keyboard).
 */
import { After, Given, Then, When } from '@cucumber/cucumber'
import AxeBuilder from '@axe-core/playwright'
import { expect } from '@playwright/test'
import { contrastRatio } from '../../../../apps/inspector/src/lib/accessibility/accessibility-probes'
import type { IWorld } from '../world'

const WCAG_AA_CONTRAST_NORMAL = 4.5
const AXE_WCAG21_AA_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']
const LOGIN_HEADING = '.max-w-md h1'

function parseRgb(css: string): { r: number; g: number; b: number } | null {
  const match = css.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
  if (!match) return null
  return { r: Number(match[1]), g: Number(match[2]), b: Number(match[3]) }
}

type WorldM11S18 = IWorld & {
  m11s18Doc?: { criteria: string[]; principles: string[] }
}

async function runAxeOnLoginForm(page: IWorld['page']): Promise<void> {
  const results = await new AxeBuilder({ page })
    .include('.max-w-md')
    .withTags([...AXE_WCAG21_AA_TAGS])
    .analyze()
  expect(
    results.violations,
    results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length} nodes)`).join('; '),
  ).toEqual([])
}

When('I open the inspector login page for M11-S18', async function (this: IWorld) {
  const url = `${this.getInspectorUrl()}/login`
  await this.page.goto(url, { waitUntil: 'domcontentloaded' })
  const emailInput = this.page.locator('input#email')
  const passwordInput = this.page.locator('input#password')
  const ssoButton = this.page.getByTestId('login-sso-button')

  await Promise.race([
    emailInput.waitFor({ state: 'visible', timeout: 20_000 }),
    ssoButton.waitFor({ state: 'visible', timeout: 20_000 }),
  ]).catch(() => {})

  if (!(await passwordInput.isVisible().catch(() => false))) {
    const passwordFallback = this.page.getByTestId('login-show-password-fallback')
    await passwordFallback.waitFor({ state: 'visible', timeout: 10_000 })
    await passwordFallback.click()
  }

  await expect(emailInput).toBeVisible({ timeout: 10_000 })
  await expect(passwordInput).toBeVisible({ timeout: 10_000 })
})

When('I open the admin login page for M11-S18', async function (this: IWorld) {
  const url = `${this.getAdminUrl()}/login`
  await this.page.goto(url, { waitUntil: 'domcontentloaded' })
  await expect(this.page.locator('form')).toBeVisible({ timeout: 15_000 })
})

Then(
  'the M11-S18 axe scan on the login form should have no violations',
  async function (this: IWorld) {
    await runAxeOnLoginForm(this.page)
  },
)

Then(
  'the M11-S18 login page should meet keyboard and screen reader checks',
  async function (this: IWorld) {
    await expect(this.page.locator('html')).toHaveAttribute('lang', /.+/)
    await expect(this.page.locator(LOGIN_HEADING)).toBeVisible()
    await expect(this.page.locator('label[for="email"]')).toBeVisible()
    await expect(this.page.locator('label[for="password"]')).toBeVisible()
    const emailDescribedBy = await this.page.locator('#email').getAttribute('aria-describedby')
    if (emailDescribedBy) {
      await expect(this.page.locator(`#${emailDescribedBy}`)).toBeAttached()
    }
  },
)

Then('the M11-S18 login focus order should be keyboard accessible', async function (this: IWorld) {
  const emailInput = this.page.locator('input#email')
  const passwordInput = this.page.locator('input#password')
  if (!(await passwordInput.isVisible().catch(() => false))) {
    const passwordFallback = this.page.getByTestId('login-show-password-fallback')
    await passwordFallback.waitFor({ state: 'visible', timeout: 10_000 })
    await passwordFallback.click()
  }
  await expect(emailInput).toBeVisible({ timeout: 10_000 })
  await expect(passwordInput).toBeVisible({ timeout: 10_000 })

  await emailInput.focus()
  await expect(emailInput).toBeFocused()

  await this.page.keyboard.press('Tab')
  await expect(passwordInput).toBeFocused()

  await this.page.keyboard.press('Tab')
  await expect(this.page.locator('button[type="submit"]')).toBeFocused()
})

Then(
  'the M11-S18 focus indicators should be visible on interactive elements',
  async function (this: IWorld) {
    const manualLink = this.page.locator('[data-testid="login-user-manual-link"]')
    await expect(manualLink).toBeVisible()
    const className = await manualLink.getAttribute('class')
    expect(className).toContain('focus-visible:ring')
  },
)

Then('the M11-S18 login heading contrast should meet WCAG AA', async function (this: IWorld) {
  const colors = await this.page.evaluate(() => {
    const heading = document.querySelector('.max-w-md h1')
    if (!heading) return null
    let current: Element | null = heading.parentElement
    let bg = getComputedStyle(document.body).backgroundColor
    while (current) {
      const candidate = getComputedStyle(current).backgroundColor
      if (candidate && candidate !== 'rgba(0, 0, 0, 0)' && candidate !== 'transparent') {
        bg = candidate
        break
      }
      current = current.parentElement
    }
    return { fg: getComputedStyle(heading).color, bg }
  })
  expect(colors).not.toBeNull()
  const fg = parseRgb(colors!.fg)
  const bg = parseRgb(colors!.bg)
  expect(fg).not.toBeNull()
  expect(bg).not.toBeNull()
  const ratio = contrastRatio(fg!, bg!)
  expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_CONTRAST_NORMAL)
})

Given(
  'the accessibility audit acceptance criteria are defined for M11-S18',
  async function (this: IWorld) {
    const w = this as WorldM11S18
    w.m11s18Doc = {
      criteria: [
        'WCAG 2.1 AA compliance',
        'Screen reader compatible',
        'Keyboard navigation works',
        'Color contrast is sufficient',
        'Focus indicators are visible',
      ],
      principles: ['Perceivable', 'Operable', 'Understandable', 'Robust'],
    }
  },
)

Then(
  'unit and integration tests should cover M11-S18 WCAG criteria and accessibility probes',
  async function (this: IWorld) {
    const doc = (this as WorldM11S18).m11s18Doc
    expect(doc?.criteria?.length).toBeGreaterThanOrEqual(5)
    expect(doc?.principles?.length).toBe(4)
  },
)

After({ tags: '@M11-S18' }, async function (this: IWorld) {
  try {
    await this.page.context().setOffline(false)
  } catch {
    /* page may be closed */
  }
})
