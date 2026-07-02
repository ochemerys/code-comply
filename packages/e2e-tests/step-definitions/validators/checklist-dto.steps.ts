/**
 * BDD contract checks for M5-S2 checklist DTOs (runs against built @codecomply/validators).
 */
import { Given, When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import { ChecklistTemplateDTOSchema, ChecklistResponseDTOSchema } from '@codecomply/validators'

const iso = '2026-03-29T15:00:00.000Z'

interface Ctx {
  payload: unknown
  success: boolean
}

const ctx: Ctx = { payload: null, success: false }

Given('a valid checklist template JSON fixture', function () {
  ctx.payload = {
    id: 'tpl-e2e-1',
    name: 'Electrical rough-in',
    discipline: 'Electrical',
    version: 1,
    versionHash: 'sha256:e2e-dto-contract',
    items: [{ id: 'it-1', order: 0, text: 'Verify bonding' }],
    isActive: true,
    createdAt: iso,
    updatedAt: iso,
  }
})

Given('a checklist response JSON with result FAIL and no codeReference', function () {
  ctx.payload = {
    itemId: 'it-1',
    result: 'FAIL',
    timestamp: iso,
  }
})

When('I validate the fixture with ChecklistTemplateDTOSchema', function () {
  const result = ChecklistTemplateDTOSchema.safeParse(ctx.payload)
  ctx.success = result.success
})

When('I validate the fixture with ChecklistResponseDTOSchema', function () {
  const result = ChecklistResponseDTOSchema.safeParse(ctx.payload)
  ctx.success = result.success
})

Then('the validation result should be successful', function () {
  expect(ctx.success).toBe(true)
})

Then('the validation result should be unsuccessful', function () {
  expect(ctx.success).toBe(false)
})
