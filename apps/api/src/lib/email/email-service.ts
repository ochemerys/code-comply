import {
  type EmailTemplateId,
  renderDeficiencyNoticeTemplate,
  renderInspectionReportTemplate,
  renderStopWorkOrderTemplate,
  renderVoCDecisionTemplate,
  renderVoCSubmissionTemplate,
} from './templates/index.js'
import {
  type EmailTransport,
  SendGridEmailTransport,
  createInMemoryDeliveryStore,
  type InMemoryDeliveryStore,
} from './email-transport.js'
import type { EmailConfig, EmailDeliveryRecord, SendTemplatedEmailInput } from './email-types.js'

export type {
  EmailAttachment,
  EmailDeliveryRecord,
  EmailDeliveryStatus,
  EmailTemplateId,
  SendTemplatedEmailInput,
} from './email-types.js'

const TEMPLATE_RENDERERS: Record<
  EmailTemplateId,
  (context: Record<string, unknown>) => { subject: string; text: string; html: string }
> = {
  'inspection-report': renderInspectionReportTemplate,
  'deficiency-notice': renderDeficiencyNoticeTemplate,
  'stop-work-order': renderStopWorkOrderTemplate,
  'voc-submission': renderVoCSubmissionTemplate,
  'voc-decision': renderVoCDecisionTemplate,
}

export function resolveEmailConfigFromEnv(env: NodeJS.ProcessEnv = process.env): EmailConfig {
  const apiKey = env.SENDGRID_API_KEY?.trim()
  if (!apiKey) {
    throw new Error('SENDGRID_API_KEY is required for email delivery')
  }

  const from = env.EMAIL_FROM?.trim()
  if (!from) {
    throw new Error('EMAIL_FROM is required for email delivery')
  }

  return { apiKey, from }
}

export class EmailService {
  constructor(
    private readonly config: EmailConfig,
    private readonly transport: EmailTransport,
    private readonly deliveries: InMemoryDeliveryStore = createInMemoryDeliveryStore(),
  ) {}

  renderTemplate(template: EmailTemplateId, context: Record<string, unknown>) {
    const render = TEMPLATE_RENDERERS[template]
    if (!render) {
      throw new Error(`Unknown email template: ${template}`)
    }
    return render(context)
  }

  async sendTemplated(input: SendTemplatedEmailInput): Promise<EmailDeliveryRecord> {
    const recipients = (Array.isArray(input.to) ? input.to : [input.to]).map((e) => e.trim())
    if (recipients.length === 0 || recipients.some((e) => !e.includes('@'))) {
      throw new Error('At least one valid recipient email is required')
    }

    const { subject, text, html } = this.renderTemplate(input.template, input.context)

    try {
      const { messageId } = await this.transport.send({
        from: this.config.from,
        to: recipients,
        subject,
        text,
        html,
        attachments: input.attachments,
      })

      const record: EmailDeliveryRecord = {
        messageId,
        status: 'sent',
        sentAt: new Date().toISOString(),
        recipients,
        template: input.template,
        subject,
      }
      this.deliveries.set(messageId, record)
      return record
    } catch (error) {
      const messageId = crypto.randomUUID()
      const record: EmailDeliveryRecord = {
        messageId,
        status: 'failed',
        sentAt: new Date().toISOString(),
        recipients,
        template: input.template,
        subject,
        error: error instanceof Error ? error.message : 'Unknown send error',
      }
      this.deliveries.set(messageId, record)
      throw error
    }
  }

  getDeliveryStatus(messageId: string): EmailDeliveryRecord | null {
    return this.deliveries.get(messageId) ?? null
  }

  listDeliveries(): EmailDeliveryRecord[] {
    return [...this.deliveries.values()]
  }
}

let defaultEmailService: EmailService | undefined

export function createEmailServiceFromEnv(env: NodeJS.ProcessEnv = process.env): EmailService {
  const config = resolveEmailConfigFromEnv(env)
  const transport = new SendGridEmailTransport(config.apiKey)
  return new EmailService(config, transport)
}

export function getEmailService(): EmailService {
  if (!defaultEmailService) {
    defaultEmailService = createEmailServiceFromEnv()
  }
  return defaultEmailService
}

export function resetEmailServiceSingleton(): void {
  defaultEmailService = undefined
}
