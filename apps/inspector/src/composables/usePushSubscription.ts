import { computed, ref } from 'vue'
import { getApiBaseUrl } from '@/lib/api-base'
import { getOrCreateDeviceId } from '@/lib/db/device-id'
import { apiFetch } from '@/utils/api-error-handler'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; ++i) {
    output[i] = raw.charCodeAt(i)
  }
  return output
}

export function isPushApiSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'PushManager' in window &&
    'serviceWorker' in navigator &&
    'Notification' in window
  )
}

export function usePushSubscription() {
  const isSupported = computed(() => isPushApiSupported())
  const isSubscribed = ref(false)
  const isLoading = ref(false)
  const errorMessage = ref<string | null>(null)

  const permission = ref<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default',
  )

  const canEnable = computed(
    () =>
      isSupported.value &&
      Boolean(VAPID_PUBLIC_KEY) &&
      permission.value !== 'denied' &&
      !isSubscribed.value,
  )

  async function refreshSubscriptionState(): Promise<void> {
    if (!isSupported.value) {
      isSubscribed.value = false
      return
    }
    const registration = await navigator.serviceWorker.ready
    const existing = await registration.pushManager.getSubscription()
    isSubscribed.value = Boolean(existing)
  }

  async function enable(): Promise<boolean> {
    if (!isSupported.value || !VAPID_PUBLIC_KEY) {
      errorMessage.value = 'Push notifications are not supported on this device.'
      return false
    }

    isLoading.value = true
    errorMessage.value = null

    try {
      const result = await Notification.requestPermission()
      permission.value = result
      if (result !== 'granted') {
        errorMessage.value = 'Notification permission was not granted.'
        return false
      }

      const registration = await navigator.serviceWorker.ready
      let subscription = await registration.pushManager.getSubscription()
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
        })
      }

      const json = subscription.toJSON()
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        throw new Error('Invalid push subscription payload')
      }

      const response = await apiFetch(`${getApiBaseUrl()}/api/notifications/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
          deviceId: getOrCreateDeviceId(),
        }),
      })

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { message?: string }
        throw new Error(body.message ?? 'Failed to save push subscription')
      }

      isSubscribed.value = true
      return true
    } catch (err) {
      errorMessage.value = err instanceof Error ? err.message : 'Failed to enable notifications'
      return false
    } finally {
      isLoading.value = false
    }
  }

  async function disable(): Promise<boolean> {
    if (!isSupported.value) return false

    isLoading.value = true
    errorMessage.value = null

    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      if (subscription) {
        await subscription.unsubscribe()
      }

      await apiFetch(`${getApiBaseUrl()}/api/notifications/unsubscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: getOrCreateDeviceId() }),
      })

      isSubscribed.value = false
      return true
    } catch (err) {
      errorMessage.value = err instanceof Error ? err.message : 'Failed to disable notifications'
      return false
    } finally {
      isLoading.value = false
    }
  }

  return {
    isSupported,
    isSubscribed,
    isLoading,
    errorMessage,
    permission,
    canEnable,
    refreshSubscriptionState,
    enable,
    disable,
  }
}
