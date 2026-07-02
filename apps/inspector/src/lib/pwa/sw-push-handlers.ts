/// <reference lib="webworker" />

export type PushPayload = {
  title?: string
  body?: string
  url?: string
}

export function parsePushPayload(event: PushEvent): PushPayload {
  if (!event.data) return {}
  try {
    return event.data.json() as PushPayload
  } catch {
    const text = event.data.text()
    return text ? { body: text } : {}
  }
}

export function resolveNotificationUrl(path: string | undefined, origin: string): string {
  const target = path?.startsWith('/') ? path : '/'
  return new URL(target, origin).href
}

export async function showPushNotification(
  registration: ServiceWorkerRegistration,
  payload: PushPayload,
): Promise<void> {
  const title = payload.title ?? 'Inspection update'
  await registration.showNotification(title, {
    body: payload.body ?? '',
    icon: '/pwa-192x192.png',
    data: { url: payload.url ?? '/' },
  })
}

export async function focusOrOpenClient(
  url: string,
  clients: ServiceWorkerGlobalScope['clients'],
): Promise<void> {
  const windowClients = await clients.matchAll({
    type: 'window',
    includeUncontrolled: true,
  })

  for (const client of windowClients) {
    if ('focus' in client) {
      if ('navigate' in client && typeof client.navigate === 'function') {
        await client.navigate(url)
      }
      await client.focus()
      return
    }
  }

  if (clients.openWindow) {
    await clients.openWindow(url)
  }
}

export function registerPushHandlers(sw: ServiceWorkerGlobalScope): void {
  sw.addEventListener('push', (event) => {
    const payload = parsePushPayload(event as PushEvent)
    event.waitUntil(
      showPushNotification(sw.registration, payload).catch((err) => {
        console.error('[sw] push handler failed', err)
      }),
    )
  })

  sw.addEventListener('notificationclick', (event) => {
    const notification = (event as NotificationEvent).notification
    notification.close()
    const path =
      notification.data && typeof notification.data.url === 'string' ? notification.data.url : '/'
    const url = resolveNotificationUrl(path, sw.location.origin)
    event.waitUntil(
      focusOrOpenClient(url, sw.clients).catch((err) => {
        console.error('[sw] notificationclick failed', err)
      }),
    )
  })
}
