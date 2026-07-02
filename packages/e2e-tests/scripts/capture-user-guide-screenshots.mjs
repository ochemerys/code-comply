#!/usr/bin/env node
/**
 * Capture real application screenshots for M11-S23 user guides.
 *
 * Prerequisites:
 *   - Dev stack running (pnpm dev or api + inspector + admin)
 *   - Database seeded (pnpm db:seed) with dev credentials
 *
 * Usage:
 *   pnpm --filter e2e-tests capture:user-guide-screenshots
 */
import { chromium } from 'playwright'
import { PrismaClient } from '@prisma/client'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const OUT_INSPECTOR = join(ROOT, '_docs/user-guides/screenshots/inspector')
const OUT_ADMIN = join(ROOT, '_docs/user-guides/screenshots/admin')

const INSPECTOR_URL = process.env.INSPECTOR_URL || 'http://localhost:5175'
const ADMIN_URL = process.env.ADMIN_URL || 'http://localhost:5174'

const INSPECTOR_CREDS = {
  email: process.env.INSPECTOR_EMAIL || 'inspector1@example.com',
  password: process.env.INSPECTOR_PASSWORD || 'password123',
}
const ADMIN_CREDS = {
  email: process.env.ADMIN_EMAIL || 'admin@example.com',
  password: process.env.ADMIN_PASSWORD || 'admin123',
}

const MOBILE = { width: 390, height: 844 }
const DESKTOP = { width: 1280, height: 800 }

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

async function waitForAdminLoginShell(page) {
  await page.getByRole('heading', { name: 'CodeComply Admin' }).waitFor({
    state: 'visible',
    timeout: 25_000,
  })
  await page.getByLabel('Email address').waitFor({ state: 'visible', timeout: 10_000 })
  await page.getByRole('button', { name: /sign in/i }).waitFor({ state: 'visible', timeout: 10_000 })
}

async function hideAdminDevCredentials(page) {
  await page.evaluate(() => {
    const note = document.querySelector('form + div.text-center.text-xs')
    if (note instanceof HTMLElement) note.style.display = 'none'
  })
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

async function prepareInspectorLoginForScreenshot(page) {
  await revealPasswordLogin(page)
  await hideLoginDevNotes(page)
  await page.evaluate(() => window.scrollTo(0, 0))
  const loginPanel = page.locator('.max-w-md.w-full.space-y-8')
  await loginPanel.scrollIntoViewIfNeeded()
  await page.waitForTimeout(400)
}

async function shot(page, filePath) {
  await page.screenshot({
    path: filePath,
    fullPage: false,
    timeout: 60_000,
    animations: 'disabled',
    caret: 'hide',
  })
  console.log(`  ✓ ${filePath.replace(ROOT + '/', '')}`)
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

async function loginAdmin(page) {
  if (!page.url().includes('/login')) {
    await waitForApp(page, `${ADMIN_URL}/login`, 'Admin portal', 'networkidle')
  }
  await waitForAdminLoginShell(page)
  await hideAdminDevCredentials(page)
  await page.getByLabel('Email address').fill(ADMIN_CREDS.email)
  await page.getByLabel('Password').fill(ADMIN_CREDS.password)
  await page.getByRole('button', { name: /sign in/i }).click()
  await page.waitForURL(`${ADMIN_URL}/`, { timeout: 25_000 })
  await page.getByTestId('page-title').waitFor({ state: 'visible', timeout: 25_000 })
  await page.getByTestId('dashboard-refresh').waitFor({ state: 'visible', timeout: 25_000 })
}

async function resolveChecklistUrl() {
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
    return `${INSPECTOR_URL}/inspections/${encodeURIComponent(inspection.id)}/checklist/${encodeURIComponent(execution.id)}`
  } finally {
    await prisma.$disconnect()
  }
}

async function captureInspector(browser) {
  console.log('\nInspector PWA (mobile viewport)')
  const context = await browser.newContext({ viewport: MOBILE, reducedMotion: 'reduce' })
  const page = await context.newPage()
  page.setDefaultTimeout(45_000)
  await context.grantPermissions(['geolocation'])
  await context.setGeolocation({ latitude: 53.5461, longitude: -113.4938 })
  await context.clearCookies()

  await waitForApp(page, `${INSPECTOR_URL}/login`, 'Inspector app', 'networkidle')
  await waitForInspectorLoginShell(page)
  await prepareInspectorLoginForScreenshot(page)
  await shot(page, join(OUT_INSPECTOR, '01-login.png'))

  await loginInspector(page)
  await page.waitForTimeout(800)
  await shot(page, join(OUT_INSPECTOR, '02-home.png'))

  await page.goto(`${INSPECTOR_URL}/permits`, { waitUntil: 'networkidle' })
  await page.getByRole('heading', { name: 'Permits', exact: true }).waitFor({
    state: 'visible',
    timeout: 20_000,
  })
  await page.waitForTimeout(500)
  await shot(page, join(OUT_INSPECTOR, '03-permits.png'))

  const checklistUrl = await resolveChecklistUrl()
  await page.goto(checklistUrl, { waitUntil: 'networkidle' })
  await page.getByTestId('checklist-execution-view').waitFor({ state: 'visible', timeout: 25_000 })
  await page.locator('[data-testid^="checklist-pass-"]').first().waitFor({
    state: 'visible',
    timeout: 20_000,
  })
  await page.waitForTimeout(500)
  await shot(page, join(OUT_INSPECTOR, '04-checklist.png'))

  await page.goto(`${INSPECTOR_URL}/`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Sync status and actions' }).click()
  await page.getByRole('menuitem', { name: 'Sync now' }).waitFor({ state: 'visible', timeout: 10_000 })
  await page.waitForTimeout(300)
  await shot(page, join(OUT_INSPECTOR, '05-sync.png'))

  await context.close()
}

async function captureAdmin(browser) {
  console.log('\nAdmin portal (desktop viewport)')
  const context = await browser.newContext({ viewport: DESKTOP, reducedMotion: 'reduce' })
  const page = await context.newPage()
  page.setDefaultTimeout(45_000)

  await waitForApp(page, `${ADMIN_URL}/login`, 'Admin portal', 'networkidle')
  await waitForAdminLoginShell(page)
  await hideAdminDevCredentials(page)
  await page.waitForTimeout(300)
  await shot(page, join(OUT_ADMIN, '01-login.png'))

  await loginAdmin(page)
  await page.waitForTimeout(800)
  await shot(page, join(OUT_ADMIN, '02-dashboard.png'))

  await page.goto(`${ADMIN_URL}/assignments/grid`, { waitUntil: 'networkidle' })
  await page.getByTestId('assignment-grid-view').waitFor({ state: 'visible', timeout: 20_000 })
  await page.waitForTimeout(500)
  await shot(page, join(OUT_ADMIN, '03-assignments.png'))

  await page.goto(`${ADMIN_URL}/inspections/monitor`, { waitUntil: 'networkidle' })
  await page.getByTestId('inspection-monitor-view').waitFor({ state: 'visible', timeout: 20_000 })
  await page.waitForTimeout(500)
  await shot(page, join(OUT_ADMIN, '04-inspection-monitor.png'))

  await page.goto(`${ADMIN_URL}/reports`, { waitUntil: 'networkidle' })
  await page.getByTestId('report-generation-view').waitFor({ state: 'visible', timeout: 20_000 })
  await page.waitForTimeout(500)
  await shot(page, join(OUT_ADMIN, '05-reports.png'))

  await context.close()
}

async function main() {
  mkdirSync(OUT_INSPECTOR, { recursive: true })
  mkdirSync(OUT_ADMIN, { recursive: true })

  console.log('M11-S23 — Capture user guide screenshots from running apps')
  console.log(`  Inspector: ${INSPECTOR_URL}`)
  console.log(`  Admin:     ${ADMIN_URL}`)

  const browser = await chromium.launch({ headless: true })

  try {
    await captureInspector(browser)
    await captureAdmin(browser)
    console.log('\nAll screenshots captured successfully.')
  } finally {
    await browser.close()
  }
}

main().catch((err) => {
  console.error('\nScreenshot capture FAILED:', err.message || err)
  process.exit(1)
})
