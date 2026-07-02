/**
 * SMS delivery stub for A-05 Senior SCO escalation.
 * Replace with Twilio (or similar) in a follow-up when credentials are configured.
 */

export type SmsDeliveryRecord = {
  to: string
  body: string
  sentAt: string
  providerMessageId: string
}

export interface SmsService {
  sendUrgent(to: string, body: string): Promise<SmsDeliveryRecord>
}

export class InMemorySmsService implements SmsService {
  readonly deliveries: SmsDeliveryRecord[] = []

  async sendUrgent(to: string, body: string): Promise<SmsDeliveryRecord> {
    const record: SmsDeliveryRecord = {
      to,
      body,
      sentAt: new Date().toISOString(),
      providerMessageId: `sms-${crypto.randomUUID()}`,
    }
    this.deliveries.push(record)
    return record
  }
}

let cachedSms: SmsService | undefined

export function getSmsService(): SmsService {
  if (!cachedSms) {
    cachedSms = new InMemorySmsService()
  }
  return cachedSms
}

export function resolveSeniorScoPhone(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const phone = env.SENIOR_SCO_PHONE?.trim()
  return phone || undefined
}
