/**
 * BDD contract checks for M6-S2 deficiency DTOs (runs against built @codecomply/validators).
 */
import { Given, When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import { CreateDeficiencyDTOSchema, UpdateDeficiencyDTOSchema } from '@codecomply/validators'

const iso = '2026-04-03T15:00:00.000Z'

interface Ctx {
  payload: unknown
  success: boolean
}

const ctx: Ctx = { payload: null, success: false }

Given('a valid create deficiency JSON fixture', function () {
  ctx.payload = {
    clientId: 'e2e-client-def-1',
    inspectionId: 'e2e-insp-1',
    checklistItemId: 'item-gfci',
    description: 'Valid deficiency description with enough characters.',
    location: 'Kitchen',
    severity: 'MAJOR',
    codeReference: { code: 'NBC', section: '9.10.1' },
    dueDate: iso,
  }
})

Given('a create deficiency JSON with description shorter than 10 characters', function () {
  ctx.payload = {
    clientId: 'e2e-client-def-2',
    inspectionId: 'e2e-insp-2',
    description: 'tooshort',
    severity: 'MINOR',
  }
})

Given('an update deficiency JSON that includes clientId', function () {
  ctx.payload = {
    clientId: 'must-not-appear',
    description: 'Patch text that is definitely long enough here.',
  }
})

When('I validate the fixture with CreateDeficiencyDTOSchema', function () {
  const result = CreateDeficiencyDTOSchema.safeParse(ctx.payload)
  ctx.success = result.success
})

When('I validate the fixture with UpdateDeficiencyDTOSchema', function () {
  const result = UpdateDeficiencyDTOSchema.safeParse(ctx.payload)
  ctx.success = result.success
})

Then('the deficiency DTO validation should succeed', function () {
  expect(ctx.success).toBe(true)
})

Then('the deficiency DTO validation should fail', function () {
  expect(ctx.success).toBe(false)
})
