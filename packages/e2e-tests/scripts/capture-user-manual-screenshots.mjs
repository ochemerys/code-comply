#!/usr/bin/env node
/**
 * Capture in-app user manual screenshots for CodeComply Field (apps/inspector/public/user-manual).
 *
 * Prerequisites:
 *   - Dev stack running (pnpm dev:inspector-stack or pnpm dev)
 *   - Database seeded (pnpm db:seed)
 *
 * Usage:
 *   pnpm --filter e2e-tests capture:user-manual-screenshots
 */
import { chromium } from 'playwright'
import { PrismaClient } from '@prisma/client'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const OUT_DIR = join(ROOT, 'apps/inspector/public/user-manual')

const INSPECTOR_URL = process.env.INSPECTOR_URL || 'http://localhost:5175'

const INSPECTOR_CREDS = {
  email: process.env.INSPECTOR_EMAIL || 'inspector1@example.com',
  password: process.env.INSPECTOR_PASSWORD || 'password123',
}

const TABLET_L = { width: 1024, height: 800 }

async function waitForApp(page, url, label, waitUntil = 'domcontentloaded') {
  try {
    const res = await page.goto(url, { waitUntil, timeout: 30_000 })
    if (!res || res.status() >= 500) {
      throw new Error(`${label} returned HTTP ${res?.status() ?? 'unknown'}`)
    }
  } catch (err) {
    throw new Error(
      `${label} not reachable at ${url}. Start dev servers (pnpm dev) and run pnpm db:seed.\n${err}`,
    )
  }
}

async function waitForInspectorLoginShell(page) {
  await page.waitForURL(/\/login(?:\?|$)/, { timeout: 15_000 })
  await page.getByTestId('route-loading-fallback').waitFor({ state: 'detached', timeout: 25_000 }).catch(() =>
    page.getByTestId('async-loading-fallback').waitFor({ state: 'hidden', timeout: 25_000 }).catch(() => undefined),
  )
  await page.getByRole('heading', { name: 'CodeComply Field' }).waitFor({
    state: 'visible',
    timeout: 25_000,
  })
}

async function revealPasswordLogin(page) {
  const email = page.locator('#email')
  if (await email.isVisible().catch(() => false)) return

  const devPasswordToggle = page.getByTestId('login-show-password-fallback')
  if (await devPasswordToggle.isVisible().catch(() => false)) {
    await devPasswordToggle.click()
  }

  await email.waitFor({ state: 'visible', timeout: 10_000 })
  await page.locator('button[type="submit"]').waitFor({ state: 'visible', timeout: 10_000 })
}

async function hideLoginDevNotes(page) {
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('.text-center.text-xs.text-text-dim')) {
      if (el instanceof HTMLElement) el.style.display = 'none'
    }
    const devCreds = document.querySelector('[data-testid="login-dev-credentials"]')
    if (devCreds instanceof HTMLElement) devCreds.style.display = 'none'
  })
}

async function shot(page, filePath, options = {}) {
  await page.screenshot({
    path: filePath,
    fullPage: false,
    timeout: 60_000,
    animations: 'disabled',
    caret: 'hide',
    ...options,
  })
  console.log(`  ✓ ${filePath.replace(ROOT + '/', '')}`)
}

async function shotViewportAt(page, filePath, testId) {
  await page.getByTestId(testId).scrollIntoViewIfNeeded()
  await page.waitForTimeout(300)
  await shot(page, filePath)
}

async function loginInspector(page) {
  if (!page.url().includes('/login')) {
    await waitForApp(page, `${INSPECTOR_URL}/login`, 'Inspector app', 'networkidle')
  }
  await waitForInspectorLoginShell(page)
  await revealPasswordLogin(page)
  await page.fill('#email', INSPECTOR_CREDS.email)
  await page.fill('#password', INSPECTOR_CREDS.password)
  await page.click('button[type="submit"]')
  await page.waitForURL(`${INSPECTOR_URL}/`, { timeout: 25_000 })
  await page.locator('header').waitFor({ state: 'visible', timeout: 15_000 })
}

async function resolveSeedContext() {
  const prisma = new PrismaClient()
  try {
    const permit = await prisma.permit.findUnique({ where: { permitNumber: 'BP-2024-002' } })
    if (!permit) throw new Error('Seed permit BP-2024-002 not found — run pnpm db:seed')

    const inspection = await prisma.permitInspection.findFirst({
      where: { permitId: permit.id, status: 'IN_PROGRESS' },
      orderBy: { scheduledDate: 'desc' },
    })
    if (!inspection) throw new Error('No IN_PROGRESS inspection on BP-2024-002')

    const execution = await prisma.checklistExecution.findFirst({
      where: { inspectionId: inspection.id },
      orderBy: { createdAt: 'desc' },
    })
    if (!execution) throw new Error('No checklist execution on BP-2024-002 inspection')

    const deficiency = await prisma.deficiency.findFirst({
      where: { inspectionId: inspection.id, status: 'OPEN' },
      orderBy: { createdAt: 'asc' },
    })
    if (!deficiency) throw new Error('No OPEN deficiency on BP-2024-002 inspection')

    return {
      inspectionId: inspection.id,
      executionId: execution.id,
      deficiencyId: deficiency.id,
    }
  } finally {
    await prisma.$disconnect()
  }
}

async function captureLogin(browser) {
  console.log('\nLogin (centered sign-in panel at tablet viewport scale)')
  const context = await browser.newContext({ viewport: TABLET_L, reducedMotion: 'reduce' })
  const page = await context.newPage()
  page.setDefaultTimeout(45_000)

  await waitForApp(page, `${INSPECTOR_URL}/login`, 'Inspector login', 'networkidle')
  await waitForInspectorLoginShell(page)
  await revealPasswordLogin(page)
  await hideLoginDevNotes(page)
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(400)

  const loginPanel = page.locator('.max-w-md.w-full.space-y-8')
  await loginPanel.scrollIntoViewIfNeeded()
  const panelBox = await loginPanel.boundingBox()
  if (!panelBox) throw new Error('Login panel not found for screenshot')
  const pad = 20
  await shot(page, join(OUT_DIR, 'login-screen.png'), {
    clip: {
      x: Math.max(0, panelBox.x - pad),
      y: Math.max(0, panelBox.y - pad),
      width: Math.min(TABLET_L.width, panelBox.width + pad * 2),
      height: Math.min(TABLET_L.height, panelBox.height + pad * 2),
    },
  })

  await context.close()
}

async function captureAuthenticated(browser, seed) {
  console.log('\nField workflows (tablet landscape viewport)')
  const context = await browser.newContext({ viewport: TABLET_L, reducedMotion: 'reduce' })
  const page = await context.newPage()
  page.setDefaultTimeout(45_000)
  await context.grantPermissions(['geolocation'])
  await context.setGeolocation({ latitude: 53.5461, longitude: -113.4938 })
  await context.clearCookies()

  await loginInspector(page)
  await page.waitForTimeout(500)

  await page.goto(`${INSPECTOR_URL}/permits`, { waitUntil: 'networkidle' })
  await page.getByRole('heading', { name: 'Permits', exact: true }).waitFor({
    state: 'visible',
    timeout: 20_000,
  })
  await page.getByTestId('permits-tools-toggle').click()
  await page.locator('#permits-tools-panel').waitFor({ state: 'visible', timeout: 10_000 })
  await page.waitForTimeout(400)
  await shot(page, join(OUT_DIR, 'permits-screen.png'))

  const checklistUrl = `${INSPECTOR_URL}/inspections/${encodeURIComponent(seed.inspectionId)}/checklist/${encodeURIComponent(seed.executionId)}`
  await page.goto(checklistUrl, { waitUntil: 'networkidle' })
  await page.getByTestId('checklist-execution-view').waitFor({ state: 'visible', timeout: 25_000 })
  await page.locator('[data-testid^="checklist-pass-"]').first().waitFor({
    state: 'visible',
    timeout: 20_000,
  })
  await page.waitForTimeout(400)
  await shot(page, join(OUT_DIR, 'checklist-screen.png'))

  const deficienciesUrl = `${INSPECTOR_URL}/inspections/${encodeURIComponent(seed.inspectionId)}/deficiencies`
  await page.goto(deficienciesUrl, { waitUntil: 'networkidle' })
  await page.getByTestId('deficiency-list-view').waitFor({ state: 'visible', timeout: 20_000 })
  await page.getByTestId('deficiency-list').waitFor({ state: 'visible', timeout: 20_000 })
  await page.waitForTimeout(400)
  await shot(page, join(OUT_DIR, 'deficiencies-screen.png'))

  const deficiencyDetailUrl = `${INSPECTOR_URL}/inspections/${encodeURIComponent(seed.inspectionId)}/deficiencies/${encodeURIComponent(seed.deficiencyId)}`
  await page.goto(deficiencyDetailUrl, { waitUntil: 'networkidle' })
  await page.getByTestId('deficiency-detail-view').waitFor({ state: 'visible', timeout: 20_000 })
  await page.getByTestId('deficiency-detail-submit-voc').waitFor({ state: 'visible', timeout: 20_000 })
  await page.waitForTimeout(400)
  await shot(page, join(OUT_DIR, 'deficiency-voc-detail.png'))

  const vocUrl = `${deficiencyDetailUrl}/voc`
  await page.goto(vocUrl, { waitUntil: 'networkidle' })
  await page.getByTestId('voc-submission-view').waitFor({ state: 'visible', timeout: 20_000 })
  await page.getByRole('heading', { name: 'Verification of compliance' }).waitFor({
    state: 'visible',
    timeout: 20_000,
  })
  await page.waitForTimeout(400)
  await shot(page, join(OUT_DIR, 'voc-submission-form.png'))

  const reviewUrl = `${INSPECTOR_URL}/inspections/${encodeURIComponent(seed.inspectionId)}/review`
  await page.goto(reviewUrl, { waitUntil: 'networkidle' })
  await page.getByTestId('inspection-review-view').waitFor({ state: 'visible', timeout: 25_000 })
  await page.getByTestId('inspection-summary').waitFor({ state: 'visible', timeout: 20_000 })
  await page.getByTestId('validation-errors').waitFor({ state: 'visible', timeout: 20_000 })
  await page.waitForTimeout(400)

  await shotViewportAt(page, join(OUT_DIR, 'review-summary.png'), 'inspection-summary')
  await shotViewportAt(page, join(OUT_DIR, 'review-deficiencies.png'), 'inspection-review-deficiencies')
  await shotViewportAt(page, join(OUT_DIR, 'review-outcome-photos.png'), 'inspection-review-photos')
  await page.getByTestId('inspection-review-signature-open').click()
  await page.getByTestId('inspection-review-signature-sheet').waitFor({
    state: 'visible',
    timeout: 10_000,
  })
  await page.waitForTimeout(300)
  await shot(page, join(OUT_DIR, 'review-signature.png'))
  await page.keyboard.press('Escape').catch(() => undefined)
  await page.waitForTimeout(200)
  await shotViewportAt(page, join(OUT_DIR, 'review-validation.png'), 'validation-errors')

  await context.close()
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })

  console.log('CodeComply Field — capture in-app user manual screenshots')
  console.log(`  Inspector: ${INSPECTOR_URL}`)

  const seed = await resolveSeedContext()
  const browser = await chromium.launch({ headless: true })

  try {
    await captureLogin(browser)
    await captureAuthenticated(browser, seed)
    console.log('\nAll user manual screenshots captured successfully.')
  } finally {
    await browser.close()
  }
}

main().catch((err) => {
  console.error('\nUser manual screenshot capture FAILED:', err.message || err)
  process.exit(1)
})
