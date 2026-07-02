import type { MailDataRequired } from '@sendgrid/mail'
import sgMail from '@sendgrid/mail'
import type { EmailAttachment } from './email-types.js'

export type OutboundEmailMessage = {
  from: string
  to: string[]
  subject: string
  text: string
  html: string
  attachments?: EmailAttachment[]
}

export type EmailTransportResult = {
  messageId: string
}

export interface EmailTransport {
  send(message: OutboundEmailMessage): Promise<EmailTransportResult>
}

/** Maps outbound message to SendGrid mail payload. */
export function toSendGridMailData(message: OutboundEmailMessage): MailDataRequired {
  return {
    from: message.from,
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html,
    attachments: message.attachments?.map((a) => ({
      filename: a.filename,
      content:
        typeof a.content === 'string'
          ? Buffer.from(a.content, 'utf8').toString('base64')
          : a.content.toString('base64'),
      type: a.type ?? 'application/octet-stream',
      disposition: a.disposition ?? 'attachment',
    })),
  }
}

type SendGridResponse = [{ headers: Record<string, string> }, unknown]

export class SendGridEmailTransport implements EmailTransport {
  private readonly sendFn: (data: MailDataRequired) => Promise<SendGridResponse>

  constructor(apiKey: string, sendFn?: (data: MailDataRequired) => Promise<SendGridResponse>) {
    if (sendFn) {
      this.sendFn = sendFn
      return
    }

    sgMail.setApiKey(apiKey)
    this.sendFn = sgMail.send.bind(sgMail) as (data: MailDataRequired) => Promise<SendGridResponse>
  }

  async send(message: OutboundEmailMessage): Promise<EmailTransportResult> {
    const [response] = await this.sendFn(toSendGridMailData(message))
    const messageId = response.headers['x-message-id'] ?? crypto.randomUUID()
    return { messageId: String(messageId) }
  }
}

export type InMemoryDeliveryStore = Map<string, import('./email-types.js').EmailDeliveryRecord>

export function createInMemoryDeliveryStore(): InMemoryDeliveryStore {
  return new Map()
}
