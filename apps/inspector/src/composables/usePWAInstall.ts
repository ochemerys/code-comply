import { ref, onMounted } from 'vue'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function usePWAInstall() {
  const canInstall = ref(false)
  const deferredPrompt = ref<BeforeInstallPromptEvent | null>(null)

  onMounted(() => {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault()
      deferredPrompt.value = e as BeforeInstallPromptEvent
      canInstall.value = true
    })

    window.addEventListener('appinstalled', () => {
      canInstall.value = false
      deferredPrompt.value = null
    })
  })

  const promptInstall = async () => {
    if (!deferredPrompt.value) {
      return
    }

    deferredPrompt.value.prompt()

    const { outcome } = await deferredPrompt.value.userChoice

    if (outcome === 'accepted') {
      canInstall.value = false
    }

    deferredPrompt.value = null
  }

  return {
    canInstall,
    promptInstall,
  }
}
