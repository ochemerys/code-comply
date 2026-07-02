import webpush from 'web-push'
import type { PushSubscriptionBody } from '@codecomply/validators'
import { prisma } from '@codecomply/db'

export type PushNotificationPayload = {
  title: string
  body: string
  url: string
  tag?: string
}

let vapidConfigured = false

function configureVapid(): void {
  if (vapidConfigured) return
  const publicKey = process.env.VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT ?? 'mailto:push@localhost'
  if (!publicKey || !privateKey) {
    throw new Error('VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY must be set for push notifications')
  }
  webpush.setVapidDetails(subject, publicKey, privateKey)
  vapidConfigured = true
}

export function isPushConfigured(): boolean {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY)
}

export class PushNotificationService {
  async upsertSubscription(userId: string, body: PushSubscriptionBody) {
    return prisma.devicePushSubscription.upsert({
      where: { userId_deviceId: { userId, deviceId: body.deviceId } },
      create: {
        userId,
        deviceId: body.deviceId,
        endpoint: body.endpoint,
        p256dh: body.keys.p256dh,
        auth: body.keys.auth,
      },
      update: {
        endpoint: body.endpoint,
        p256dh: body.keys.p256dh,
        auth: body.keys.auth,
      },
    })
  }

  async removeSubscription(userId: string, deviceId: string): Promise<boolean> {
    const result = await prisma.devicePushSubscription.deleteMany({
      where: { userId, deviceId },
    })
    return result.count > 0
  }

  async sendToUser(
    userId: string,
    payload: PushNotificationPayload,
  ): Promise<{ sent: number; failed: number }> {
    if (!isPushConfigured()) {
      return { sent: 0, failed: 0 }
    }

    configureVapid()

    const subscriptions = await prisma.devicePushSubscription.findMany({
      where: { userId },
    })

    if (subscriptions.length === 0) {
      return { sent: 0, failed: 0 }
    }

    const body = JSON.stringify(payload)
    let sent = 0
    let failed = 0

    await Promise.all(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            body,
          )
          sent += 1
        } catch (err) {
          failed += 1
          const statusCode =
            err && typeof err === 'object' && 'statusCode' in err
              ? (err as { statusCode?: number }).statusCode
              : undefined
          if (statusCode === 404 || statusCode === 410) {
            await prisma.devicePushSubscription
              .delete({ where: { id: sub.id } })
              .catch(() => undefined)
          }
          console.warn('[push] send failed', { userId, endpoint: sub.endpoint, statusCode })
        }
      }),
    )

    return { sent, failed }
  }

  async sendNewAssignmentNotification(userId: string, permitId: string): Promise<void> {
    await this.sendToUser(userId, {
      title: 'New assignment',
      body: 'You have been assigned a new inspection.',
      url: `/permits/${permitId}`,
      tag: `assignment-${permitId}`,
    })
  }

  async sendTestNotification(
    userId: string,
    overrides?: Partial<PushNotificationPayload> & { path?: string },
  ): Promise<{ sent: number; failed: number }> {
    const deepLink = overrides?.path ?? overrides?.url ?? '/'
    return this.sendToUser(userId, {
      title: overrides?.title ?? 'Test notification',
      body: overrides?.body ?? 'Push notifications are working.',
      url: deepLink.startsWith('/') ? deepLink : `/${deepLink}`,
      tag: 'push-test',
    })
  }
}

export const pushNotificationService = new PushNotificationService()
