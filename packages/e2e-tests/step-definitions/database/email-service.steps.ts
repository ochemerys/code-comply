/**
 * M10-S11 — Email service BDD smoke (mock transport + delivery tracking).
 */
import { Given, When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import { EmailService } from '../../../../apps/api/src/lib/email/email-service.js'
import type { EmailTransport } from '../../../../apps/api/src/lib/email/email-transport.js'

let messageId = ''

const transport: EmailTransport = {
  send: async () => ({ messageId: `e2e-${Date.now()}` }),
}

const service = new EmailService({ apiKey: 'e2e-key', from: 'noreply@e2e.test' }, transport)

Given('M10-S11 email service test harness is ready', function () {
  messageId = ''
})

When('an inspection report email is sent with a PDF attachment', async function () {
  const record = await service.sendTemplated({
    to: 'holder@example.com',
    template: 'inspection-report',
    context: {
      permitNumber: 'E2E-P-1',
      inspectionId: 'insp-e2e',
      recipientName: 'Holder',
    },
    attachments: [
      {
        filename: 'report.pdf',
        content: Buffer.from('%PDF-e2e'),
        type: 'application/pdf',
      },
    ],
  })
  messageId = record.messageId
  expect(record.status).toBe('sent')
})

Then('delivery status should be available for that message', function () {
  const status = service.getDeliveryStatus(messageId)
  expect(status?.template).toBe('inspection-report')
  expect(status?.recipients).toEqual(['holder@example.com'])
})
