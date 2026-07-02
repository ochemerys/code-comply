export type EmailTemplateId =
  | 'inspection-report'
  | 'deficiency-notice'
  | 'stop-work-order'
  | 'voc-submission'
  | 'voc-decision'

export type EmailAttachment = {
  filename: string
  content: Buffer | string
  type?: string
  disposition?: 'attachment' | 'inline'
}

export type EmailDeliveryStatus = 'queued' | 'sent' | 'failed'

export type EmailDeliveryRecord = {
  messageId: string
  status: EmailDeliveryStatus
  sentAt: string
  recipients: string[]
  template: EmailTemplateId
  subject: string
  error?: string
}

export type SendTemplatedEmailInput = {
  to: string | string[]
  template: EmailTemplateId
  context: Record<string, unknown>
  attachments?: EmailAttachment[]
}

export type EmailConfig = {
  from: string
  apiKey: string
}
