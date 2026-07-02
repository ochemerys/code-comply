import { Given, When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import { sanitizeDeep, sanitizeFilename } from '../../../../apps/api/src/lib/sanitization.js'

let payload: Record<string, unknown>
let sanitized: Record<string, unknown>
let rawFilename: string
let sanitizedFilename: string

Given('a JSON payload with an HTML script injection in description', function () {
  payload = {
    description: '<script>alert("xss")</script>Missing GFCI protection in required locations.',
  }
})

Given('a JSON payload with a SQL injection attempt in description', function () {
  payload = {
    description: "'; DROP TABLE deficiencies; -- Major wiring issue found here.",
  }
})

Given('a file name containing path traversal sequences', function () {
  rawFilename = '..\\..\\deep\\notice.pdf'
})

When('the payload is sanitized by the input sanitization library', function () {
  sanitized = sanitizeDeep(payload) as Record<string, unknown>
})

When('the file name is sanitized by the input sanitization library', function () {
  sanitizedFilename = sanitizeFilename(rawFilename)
})

Then('the sanitized description should not contain script tags', function () {
  const description = String(sanitized.description ?? '')
  expect(description.toLowerCase()).not.toContain('<script')
  expect(description.toLowerCase()).not.toContain('</script>')
})

Then('the sanitized description should contain the safe wiring issue text', function () {
  const description = String(sanitized.description ?? '')
  expect(description).toContain('Major wiring issue found here')
})

Then('the sanitized description should preserve safe text content', function () {
  const description = String(sanitized.description ?? '')
  expect(description).toContain('Missing GFCI protection')
})

Then('the sanitized description should not contain SQL metacharacters', function () {
  const description = String(sanitized.description ?? '')
  expect(description).not.toContain("'")
  expect(description).not.toContain(';')
})

Then('the sanitized file name should not contain parent directory references', function () {
  expect(sanitizedFilename).not.toContain('..')
  expect(sanitizedFilename).not.toMatch(/[/\\]/)
})

Then('the sanitized file name should retain the base file name', function () {
  expect(sanitizedFilename).toBe('notice.pdf')
})
