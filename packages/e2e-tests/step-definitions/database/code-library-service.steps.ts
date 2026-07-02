/**
 * M5-S4: CodeLibraryService BDD steps (real DB + domain service).
 */
import { Given, When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import { CodeLibraryService } from '../../../../apps/api/src/services/code-library.service.js'

const prisma = new PrismaClient()
const service = new CodeLibraryService()

interface Ctx {
  searchHits?: { code: string; section: string }[]
  resolvedTitle?: string | null
  listCount?: number
  sections?: string[]
}

const ctx: Ctx = {}

Given('code library service E2E data is prepared', async function () {
  await prisma.codeLibrary.deleteMany()
  await prisma.codeLibrary.createMany({
    data: [
      {
        code: 'NBC',
        section: '9.10.1',
        title: 'Fire separation of residential units',
        description: 'Ratings',
      },
      {
        code: 'NBC',
        section: '9.23.1',
        title: 'Wood framing',
        description: null,
      },
      {
        code: 'IFC',
        section: '903.1',
        title: 'Automatic sprinkler systems',
        description: null,
      },
    ],
  })
})

When('I search the code library for {string}', async function (term: string) {
  const rows = await service.search(term)
  ctx.searchHits = rows.map((r) => ({ code: r.code, section: r.section }))
})

Then('I should get at least one NBC result', function () {
  expect(ctx.searchHits?.some((h) => h.code === 'NBC')).toBe(true)
})

When(
  'I resolve code {string} section {string} via CodeLibraryService',
  async function (code: string, section: string) {
    const row = await service.getByCode(code, section)
    ctx.resolvedTitle = row?.title ?? null
  },
)

Then('the resolved title should be {string}', function (expected: string) {
  expect(ctx.resolvedTitle).toBe(expected)
})

When('I list code library entries for type {string}', async function (codeType: string) {
  const rows = await service.listByType(codeType)
  ctx.listCount = rows.length
  ctx.sections = rows.map((r) => r.section)
})

Then('I should get multiple sections ordered by section', function () {
  expect(ctx.listCount).toBeGreaterThanOrEqual(2)
  const sorted = [...(ctx.sections ?? [])].sort((a, b) => a.localeCompare(b))
  expect(ctx.sections).toEqual(sorted)
})
