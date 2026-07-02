import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  EmailService,
  resolveEmailConfigFromEnv,
  createEmailServiceFromEnv,
  resetEmailServiceSingleton,
} from './email-service.js'
import type { EmailTransport } from './email-transport.js'
import {
  renderDeficiencyNoticeTemplate,
  renderInspectionReportTemplate,
  renderStopWorkOrderTemplate,
  renderVoCDecisionTemplate,
  renderVoCSubmissionTemplate,
} from './templates/index.js'

describe('resolveEmailConfigFromEnv', () => {
  it('reads SendGrid config from env', () => {
    expect(
      resolveEmailConfigFromEnv({
        SENDGRID_API_KEY: 'sg-key',
        EMAIL_FROM: 'noreply@example.com',
      }),
    ).toEqual({
      apiKey: 'sg-key',
      from: 'noreply@example.com',
    })
  })

  it('throws when SENDGRID_API_KEY is missing', () => {
    expect(() => resolveEmailConfigFromEnv({ EMAIL_FROM: 'a@b.com' })).toThrow(/SENDGRID_API_KEY/)
  })

  it('throws when EMAIL_FROM is missing', () => {
    expect(() => resolveEmailConfigFromEnv({ SENDGRID_API_KEY: 'k' })).toThrow(/EMAIL_FROM/)
  })
})

describe('email templates', () => {
  it('renders inspection-report template', () => {
    const out = renderInspectionReportTemplate({
      permitNumber: 'P-1',
      inspectionId: 'insp-1',
      recipientName: 'Alex',
    })
    expect(out.subject).toContain('P-1')
    expect(out.text).toContain('Alex')
    expect(out.html).toContain('insp-1')
  })

  it('renders deficiency-notice template', () => {
    const out = renderDeficiencyNoticeTemplate({
      permitNumber: 'P-2',
      deficiencyDescription: 'Missing guard',
    })
    expect(out.subject).toContain('Deficiency Notice')
    expect(out.text).toContain('Missing guard')
  })

  it('renders stop-work-order template', () => {
    const out = renderStopWorkOrderTemplate({
      permitNumber: 'P-3',
      deficiencyDescription: 'Unsafe excavation',
    })
    expect(out.subject).toContain('STOP WORK')
    expect(out.html).toContain('STOP WORK ORDER')
  })

  it('renders voc-submission template', () => {
    const out = renderVoCSubmissionTemplate({
      permitNumber: 'P-4',
      deficiencyTitle: 'Guardrail',
      submittedBy: 'Owner',
    })
    expect(out.subject).toContain('VoC Submitted')
  })

  it('renders voc-decision template', () => {
    const out = renderVoCDecisionTemplate({
      permitNumber: 'P-5',
      decision: 'ACCEPTED',
      reviewerName: 'Admin',
    })
    expect(out.subject).toContain('VoC Decision')
    expect(out.text).toContain('ACCEPTED')
  })
})

describe('EmailService', () => {
  const transport: EmailTransport = {
    send: vi.fn(async () => ({ messageId: 'msg-123' })),
  }

  let service: EmailService

  beforeEach(() => {
    vi.mocked(transport.send).mockClear()
    service = new EmailService({ apiKey: 'test-key', from: 'noreply@example.com' }, transport)
  })

  it('sendTemplated delivers email and tracks status', async () => {
    const record = await service.sendTemplated({
      to: 'owner@example.com',
      template: 'inspection-report',
      context: {
        permitNumber: 'P-100',
        inspectionId: 'insp-9',
        recipientName: 'Owner',
      },
    })

    expect(record.status).toBe('sent')
    expect(record.messageId).toBe('msg-123')
    expect(record.template).toBe('inspection-report')
    expect(service.getDeliveryStatus('msg-123')?.recipients).toEqual(['owner@example.com'])
    expect(transport.send).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'noreply@example.com',
        to: ['owner@example.com'],
        subject: expect.stringContaining('P-100'),
      }),
    )
  })

  it('sendTemplated supports attachments', async () => {
    await service.sendTemplated({
      to: ['a@example.com', 'b@example.com'],
      template: 'deficiency-notice',
      context: { permitNumber: 'P-2', deficiencyDescription: 'Issue' },
      attachments: [
        {
          filename: 'notice.pdf',
          content: Buffer.from('%PDF-1.4'),
          type: 'application/pdf',
        },
      ],
    })

    expect(transport.send).toHaveBeenCalledWith(
      expect.objectContaining({
        attachments: [
          expect.objectContaining({
            filename: 'notice.pdf',
            type: 'application/pdf',
          }),
        ],
      }),
    )
  })

  it('rejects invalid recipients', async () => {
    await expect(
      service.sendTemplated({
        to: 'not-an-email',
        template: 'voc-decision',
        context: { permitNumber: 'P-1', decision: 'REJECTED' },
      }),
    ).rejects.toThrow(/valid recipient/)
  })

  it('records failed delivery when transport throws', async () => {
    vi.mocked(transport.send).mockRejectedValueOnce(new Error('SendGrid unavailable'))

    await expect(
      service.sendTemplated({
        to: 'owner@example.com',
        template: 'stop-work-order',
        context: { permitNumber: 'P-9', deficiencyDescription: 'Unsafe' },
      }),
    ).rejects.toThrow('SendGrid unavailable')

    const failed = service.listDeliveries().find((d) => d.status === 'failed')
    expect(failed?.error).toContain('SendGrid unavailable')
  })
})

describe('createEmailServiceFromEnv', () => {
  beforeEach(() => {
    resetEmailServiceSingleton()
  })

  it('constructs service with SendGrid transport', () => {
    const service = createEmailServiceFromEnv({
      SENDGRID_API_KEY: 'sg-test',
      EMAIL_FROM: 'noreply@test.com',
    })
    expect(service).toBeInstanceOf(EmailService)
  })
})
