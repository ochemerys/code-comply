import { describe, it, expect } from 'vitest'
import { EmailService } from '../../src/lib/email/email-service.js'
import type { EmailTransport } from '../../src/lib/email/email-transport.js'

describe.sequential('EmailService integration (M10-S11)', () => {
  const sent: Array<{ subject: string; attachments?: unknown[] }> = []

  const transport: EmailTransport = {
    send: async (message) => {
      sent.push({ subject: message.subject, attachments: message.attachments })
      return { messageId: `integration-${sent.length}` }
    },
  }

  const service = new EmailService(
    { apiKey: 'integration-key', from: 'noreply@integration.test' },
    transport,
  )

  it('sends inspection-report email with PDF attachment', async () => {
    sent.length = 0
    const record = await service.sendTemplated({
      to: 'permit-holder@example.com',
      template: 'inspection-report',
      context: {
        permitNumber: 'INT-P-1',
        inspectionId: 'insp-int-1',
        recipientName: 'Permit Holder',
      },
      attachments: [
        {
          filename: 'inspection-report.pdf',
          content: Buffer.from('%PDF-1.4 integration'),
          type: 'application/pdf',
        },
      ],
    })

    expect(record.status).toBe('sent')
    expect(sent[0]?.attachments).toHaveLength(1)
    expect(service.getDeliveryStatus(record.messageId)?.template).toBe('inspection-report')
  })

  it('sends voc-decision template and tracks delivery', async () => {
    const record = await service.sendTemplated({
      to: 'owner@example.com',
      template: 'voc-decision',
      context: {
        permitNumber: 'INT-P-2',
        decision: 'ACCEPTED',
        reviewerName: 'Admin User',
        comments: 'Evidence sufficient',
      },
    })

    expect(record.subject).toContain('VoC Decision')
    expect(service.listDeliveries().some((d) => d.messageId === record.messageId)).toBe(true)
  })

  it('renders all required distribution templates', () => {
    const templates = [
      'inspection-report',
      'deficiency-notice',
      'stop-work-order',
      'voc-submission',
      'voc-decision',
    ] as const

    for (const template of templates) {
      const rendered = service.renderTemplate(template, { permitNumber: 'P-X' })
      expect(rendered.subject.length).toBeGreaterThan(0)
      expect(rendered.html).toContain('P-X')
    }
  })
})
