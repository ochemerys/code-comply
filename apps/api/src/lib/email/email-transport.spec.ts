import { describe, it, expect } from 'vitest'
import { SendGridEmailTransport, toSendGridMailData } from './email-transport.js'

describe('toSendGridMailData', () => {
  it('maps attachments to base64 SendGrid format', () => {
    const data = toSendGridMailData({
      from: 'noreply@example.com',
      to: ['user@example.com'],
      subject: 'Test',
      text: 'Hello',
      html: '<p>Hello</p>',
      attachments: [
        {
          filename: 'report.pdf',
          content: Buffer.from('%PDF'),
          type: 'application/pdf',
        },
      ],
    })

    expect(data.attachments?.[0]).toMatchObject({
      filename: 'report.pdf',
      type: 'application/pdf',
      disposition: 'attachment',
    })
    expect(typeof data.attachments?.[0]?.content).toBe('string')
  })
})

describe('SendGridEmailTransport', () => {
  it('returns message id from SendGrid response headers', async () => {
    const transport = new SendGridEmailTransport('key', async () => [
      { headers: { 'x-message-id': 'sg-msg-42' } },
      {},
    ])

    const result = await transport.send({
      from: 'noreply@example.com',
      to: ['user@example.com'],
      subject: 'Hi',
      text: 'Body',
      html: '<p>Body</p>',
    })

    expect(result.messageId).toBe('sg-msg-42')
  })
})
