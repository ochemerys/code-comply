/**
 * M10-S17 — Reporting & VoC workflow E2E steps (API services + admin/inspector UI).
 */
import { After, Given, When, Then } from '@cucumber/cucumber'
import { expect, type Response } from '@playwright/test'
import type { PrismaClient } from '@prisma/client'
import {
  ReportService,
  REPORT_SIGNED_URL_TTL_SECONDS,
} from '../../../apps/api/src/services/report.service.js'
import type { ObjectStorageClient } from '../../../apps/api/src/lib/storage/storage-client.js'
import type { IWorld } from './world'

type PrismaClientWithPhoto = PrismaClient & {
  photo: { deleteMany: (args?: { where?: object }) => Promise<unknown> }
}

const M10_S17_NOTES = 'M10-S17 e2e reporting'

const storage = {
  putObject: async () => {},
  getSignedGetUrl: async (_kind: 'photos' | 'documents', key: string) =>
    `https://e2e.example/${key}?ttl=${REPORT_SIGNED_URL_TTL_SECONDS}`,
  getObjectBytes: async () => new Uint8Array(),
} as unknown as ObjectStorageClient

const reportService = new ReportService(storage)

const m10s17: {
  permitId: string
  permitNumber: string
  inspectionId: string
  reportId: string
  deficiencyId: string
  vocId: string
  inspectorId: string
  lastDownloadUrl: string
} = {
  permitId: '',
  permitNumber: '',
  inspectionId: '',
  reportId: '',
  deficiencyId: '',
  vocId: '',
  inspectorId: '',
  lastDownloadUrl: '',
}

After({ tags: '@M10-S17' }, async function (this: IWorld) {
  try {
    const prisma = this.testDb.getClient() as PrismaClientWithPhoto
    await cleanM10S17(prisma)
  } catch {
    /* testDb may be unavailable during teardown */
  }
})

async function cleanM10S17(prisma: PrismaClientWithPhoto): Promise<void> {
  await prisma.verificationOfCompliance.deleteMany({
    where: { deficiency: { inspection: { notes: M10_S17_NOTES } } },
  })
  await prisma.report.deleteMany({
    where: { inspection: { notes: M10_S17_NOTES } },
  })
  await prisma.photo.deleteMany({ where: { inspection: { notes: M10_S17_NOTES } } })
  await prisma.deficiency.deleteMany({ where: { inspection: { notes: M10_S17_NOTES } } })
  await prisma.inspectionSchedule.deleteMany({ where: { inspection: { notes: M10_S17_NOTES } } })
  await prisma.permitInspection.deleteMany({ where: { notes: M10_S17_NOTES } })
  await prisma.permit.deleteMany({ where: { permitNumber: { startsWith: 'M10-S17-E2E-' } } })
}

async function seedReportingInspection(
  prisma: PrismaClientWithPhoto,
  options: { status: 'PASSED' | 'IN_PROGRESS' },
): Promise<{ permitId: string; permitNumber: string; inspectionId: string; inspectorId: string }> {
  await cleanM10S17(prisma)

  const inspector = await prisma.user.findUniqueOrThrow({
    where: { email: 'test-inspector@example.com' },
  })

  const permitNumber = `M10-S17-E2E-${Date.now()}`
  const permit = await prisma.permit.create({
    data: {
      permitNumber,
      address: '17 Reporting Lane',
      legalLandDesc: 'NW-17-052-24-W5',
      scope: 'Residential',
      status: 'ACTIVE',
    },
  })

  const inspection = await prisma.permitInspection.create({
    data: {
      permitId: permit.id,
      scheduledDate: new Date('2026-12-01T09:00:00.000Z'),
      status: options.status,
      ...(options.status === 'PASSED'
        ? { completedDate: new Date('2026-12-01T11:00:00.000Z') }
        : {}),
      inspectorId: inspector.id,
      notes: M10_S17_NOTES,
    },
  })

  await prisma.inspectionSchedule.create({
    data: {
      inspectionId: inspection.id,
      assignedToId: inspector.id,
    },
  })

  return {
    permitId: permit.id,
    permitNumber,
    inspectionId: inspection.id,
    inspectorId: inspector.id,
  }
}

Given('M10-S17 reporting test data is prepared', async function (this: IWorld) {
  const prisma = this.testDb.getClient() as PrismaClientWithPhoto
  const seeded = await seedReportingInspection(prisma, { status: 'PASSED' })
  m10s17.permitId = seeded.permitId
  m10s17.permitNumber = seeded.permitNumber
  m10s17.inspectionId = seeded.inspectionId
  m10s17.inspectorId = seeded.inspectorId
  m10s17.reportId = ''
  m10s17.deficiencyId = ''
  m10s17.vocId = ''
})

Given('M10-S17 compliance search test data is prepared', async function (this: IWorld) {
  const prisma = this.testDb.getClient() as PrismaClientWithPhoto
  const seeded = await seedReportingInspection(prisma, { status: 'PASSED' })
  m10s17.permitId = seeded.permitId
  m10s17.permitNumber = seeded.permitNumber
  m10s17.inspectionId = seeded.inspectionId
  m10s17.inspectorId = seeded.inspectorId
  m10s17.reportId = ''
  m10s17.deficiencyId = ''
  m10s17.vocId = ''
})

Given('M10-S17 VoC workflow test data is prepared', async function (this: IWorld) {
  const prisma = this.testDb.getClient() as PrismaClientWithPhoto
  const seeded = await seedReportingInspection(prisma, { status: 'IN_PROGRESS' })

  const deficiency = await prisma.deficiency.create({
    data: {
      clientId: `m10-s17-voc-${Date.now()}`,
      inspectionId: seeded.inspectionId,
      createdById: seeded.inspectorId,
      description: 'M10-S17 E2E deficiency for VoC workflow',
      severity: 'MAJOR',
      status: 'OPEN',
    },
  })

  m10s17.permitId = seeded.permitId
  m10s17.permitNumber = seeded.permitNumber
  m10s17.inspectionId = seeded.inspectionId
  m10s17.inspectorId = seeded.inspectorId
  m10s17.deficiencyId = deficiency.id
  m10s17.reportId = ''
  m10s17.vocId = ''
})

async function generateM10S17Report(): Promise<void> {
  if (!m10s17.inspectionId) throw new Error('M10-S17 inspection not seeded')
  const row = await reportService.generateAndStore({
    inspectionId: m10s17.inspectionId,
    type: 'INSPECTION',
  })
  m10s17.reportId = row.id
}

When('an inspection report PDF is generated for M10-S17', async function () {
  await generateM10S17Report()
})

Then(
  'the M10-S17 report should be a valid PDF with stored metadata',
  async function (this: IWorld) {
    if (!m10s17.reportId) throw new Error('M10-S17 report not generated')
    const prisma = this.testDb.getClient()
    const row = await prisma.report.findUniqueOrThrow({ where: { id: m10s17.reportId } })
    expect(row.hash).toMatch(/^[a-f0-9]{64}$/)
    expect(row.filename).toMatch(/\.pdf$/i)
    expect(row.storageKey).toContain('reports/')
    expect(row.type).toBe('INSPECTION')
  },
)

Then('a signed download URL should be available for the M10-S17 report', async function () {
  if (!m10s17.reportId) throw new Error('M10-S17 report not generated')
  const url = await reportService.getSignedDownloadUrl(m10s17.reportId)
  expect(url).toContain('https://e2e.example/')
  m10s17.lastDownloadUrl = url
})

When('I open the admin reports page for the M10-S17 inspection', async function (this: IWorld) {
  if (!m10s17.inspectionId) throw new Error('M10-S17 inspection not seeded')
  await this.page.goto(`${this.getAdminUrl()}/reports`)
  await expect(this.page.getByTestId('report-generation-view')).toBeVisible({ timeout: 25_000 })

  const statusFilter = this.page.getByTestId('report-generator-status-filter')
  await statusFilter.selectOption('PASSED')

  await this.page.getByTestId('report-generator-inspection').selectOption(m10s17.inspectionId)
  await expect(this.page.getByTestId('report-history')).toBeVisible({ timeout: 15_000 })
})

When('I download the M10-S17 report from report history', async function (this: IWorld) {
  if (!m10s17.reportId) throw new Error('M10-S17 report not generated')
  const downloadButton = this.page.getByTestId(`report-history-download-${m10s17.reportId}`)
  await expect(downloadButton).toBeVisible({ timeout: 15_000 })

  const [response] = await Promise.all([
    this.page.waitForResponse(
      (res: Response) =>
        res.url().includes(`/api/reports/${encodeURIComponent(m10s17.reportId)}/download`) &&
        res.ok(),
      { timeout: 25_000 },
    ),
    downloadButton.click(),
  ])

  const body = (await response.json()) as { url?: string }
  m10s17.lastDownloadUrl = body.url ?? ''
})

Then('the M10-S17 report download request should succeed', async function () {
  expect(m10s17.lastDownloadUrl).toMatch(/^https?:\/\//)
  expect(m10s17.lastDownloadUrl).toMatch(/\.pdf|reports\//i)
})

When('I search compliance records by the M10-S17 permit number', async function (this: IWorld) {
  if (!m10s17.permitNumber) throw new Error('M10-S17 permit number not seeded')
  await this.page.getByTestId('advanced-search-permit').fill(m10s17.permitNumber)

  const [response] = await Promise.all([
    this.page.waitForResponse(
      (res: Response) => res.url().includes('/api/admin/compliance-search') && res.ok(),
      { timeout: 25_000 },
    ),
    this.page.getByTestId('advanced-search-submit').click(),
  ])

  expect(response.ok()).toBeTruthy()
  await expect(this.page.getByTestId('compliance-search-results')).toBeVisible({ timeout: 15_000 })
})

Then('I should see M10-S17 compliance search results', async function (this: IWorld) {
  if (!m10s17.inspectionId) throw new Error('M10-S17 inspection not seeded')
  await expect(this.page.getByTestId('compliance-search-table')).toBeVisible({ timeout: 15_000 })
  await expect(this.page.getByTestId(`compliance-search-row-${m10s17.inspectionId}`)).toBeVisible()
})

When('I submit VoC for the M10-S17 deficiency via the inspector UI', async function (this: IWorld) {
  if (!m10s17.inspectionId || !m10s17.deficiencyId) {
    throw new Error('M10-S17 VoC workflow data not seeded')
  }

  const url = `${this.getInspectorUrl()}/inspections/${encodeURIComponent(m10s17.inspectionId)}/deficiencies/${encodeURIComponent(m10s17.deficiencyId)}/voc`
  await this.page.goto(url)
  await expect(this.page.getByTestId('voc-submission-view')).toBeVisible({ timeout: 25_000 })
  await expect(this.page.getByTestId('voc-form')).toBeVisible({ timeout: 25_000 })

  const today = new Date()
  const ymd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  await this.page.getByTestId('voc-verification-date').fill(ymd)
  await this.page.getByTestId('voc-section-title').fill('Division B — Safety')
  await this.page.getByTestId('voc-title').fill('Guardrail corrected')
  await this.page.getByTestId('voc-name').fill('M10-S17 E2E Contractor')
  await this.page.getByTestId('voc-method').selectOption('SITE_VISIT')
  await this.page.getByTestId('voc-comments').fill('Verified on site for M10-S17 E2E.')

  const [response] = await Promise.all([
    this.page.waitForResponse(
      (res: Response) =>
        res.url().includes(`/api/deficiencies/${encodeURIComponent(m10s17.deficiencyId)}/voc`) &&
        res.request().method() === 'POST' &&
        res.ok(),
      { timeout: 25_000 },
    ),
    this.page.getByTestId('voc-submit').click(),
  ])

  const body = (await response.json()) as { id?: string }
  m10s17.vocId = body.id ?? ''
  await expect(this.page.getByTestId('deficiency-detail-view')).toBeVisible({ timeout: 25_000 })
})

Then('the M10-S17 deficiency should show VoC submitted status', async function (this: IWorld) {
  await expect(this.page.getByTestId('deficiency-detail-status')).toContainText('VOC submitted', {
    timeout: 15_000,
  })
})

When('I open the admin VoC review page', async function (this: IWorld) {
  await this.page.goto(`${this.getAdminUrl()}/compliance/voc`)
  await expect(this.page.getByTestId('voc-review-view')).toBeVisible({ timeout: 25_000 })
})

When('I accept the M10-S17 pending VoC submission', async function (this: IWorld) {
  const prisma = this.testDb.getClient()
  if (!m10s17.vocId) {
    const voc = await prisma.verificationOfCompliance.findFirst({
      where: { deficiencyId: m10s17.deficiencyId },
      orderBy: { submittedAt: 'desc' },
    })
    if (!voc?.id) throw new Error('M10-S17 pending VoC not found')
    m10s17.vocId = voc.id
  }

  const card = this.page.getByTestId(`voc-review-card-${m10s17.vocId}`)
  await expect(card).toBeVisible({ timeout: 25_000 })
  await card.click()
  await expect(this.page.getByTestId('voc-review-accept')).toBeVisible()
  await this.page.getByTestId('voc-review-accept').click()
  await expect(this.page.getByTestId('voc-decision-dialog')).toBeVisible()

  const [response] = await Promise.all([
    this.page.waitForResponse(
      (res: Response) =>
        res.url().includes(`/api/voc/${encodeURIComponent(m10s17.vocId)}/review`) &&
        res.request().method() === 'POST' &&
        res.ok(),
      { timeout: 25_000 },
    ),
    this.page.getByTestId('voc-decision-confirm-accept').click(),
  ])

  expect(response.ok()).toBeTruthy()
  await expect(this.page.getByTestId(`voc-review-card-${m10s17.vocId}`)).toHaveCount(0, {
    timeout: 25_000,
  })
})

Then(
  'the M10-S17 deficiency should be closed after admin VoC acceptance',
  async function (this: IWorld) {
    const prisma = this.testDb.getClient()
    const deficiency = await prisma.deficiency.findUniqueOrThrow({
      where: { id: m10s17.deficiencyId },
    })
    expect(deficiency.status).toBe('CLOSED')

    const voc = await prisma.verificationOfCompliance.findUniqueOrThrow({
      where: { id: m10s17.vocId },
    })
    expect(voc.status).toBe('ACCEPTED')
  },
)
