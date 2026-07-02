import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getDb } from '@/lib/db/dexie'
import { isEncryptionServiceInitialized } from '@/lib/db/encryption'

export const useNetworkStore = defineStore('network', () => {
  const isOnline = ref(typeof navigator !== 'undefined' ? navigator.onLine : true)
  const queueSize = ref(0)
  let initialized = false
  let queueHooksRegistered = false
  let queueRefreshTimer: ReturnType<typeof setTimeout> | null = null
  let syncQueueTable: ReturnType<typeof getDb>['syncQueue'] | null = null

  function isEncryptionUnavailableError(error: unknown): boolean {
    return error instanceof Error && error.message.includes('EncryptionService not initialized')
  }

  function getSyncQueueTable(): ReturnType<typeof getDb>['syncQueue'] | null {
    if (!isEncryptionServiceInitialized()) {
      return null
    }

    try {
      return getDb().syncQueue
    } catch (error) {
      if (isEncryptionUnavailableError(error)) {
        return null
      }
      throw error
    }
  }

  const refreshQueueSize = async () => {
    const table = getSyncQueueTable()
    if (!table) {
      queueSize.value = 0
      return
    }

    try {
      queueSize.value = await table.where('status').equals('PENDING').count()
    } catch (error) {
      if (isEncryptionUnavailableError(error)) {
        queueSize.value = 0
        return
      }
      throw error
    }
  }

  const scheduleQueueSizeRefresh = () => {
    if (queueRefreshTimer) {
      clearTimeout(queueRefreshTimer)
    }

    queueRefreshTimer = setTimeout(() => {
      queueRefreshTimer = null
      void refreshQueueSize()
    }, 250)
  }

  const handleQueueChange = () => {
    scheduleQueueSizeRefresh()
  }

  const handleOnline = () => {
    isOnline.value = true
    console.log('Network: Online')
  }

  const handleOffline = () => {
    isOnline.value = false
    console.log('Network: Offline')
  }

  const registerQueueHooks = () => {
    if (queueHooksRegistered) {
      return
    }

    const table = getSyncQueueTable()
    if (!table) {
      queueSize.value = 0
      return
    }

    table.hook('creating', handleQueueChange)
    table.hook('deleting', handleQueueChange)
    table.hook('updating', handleQueueChange)
    syncQueueTable = table
    queueHooksRegistered = true
  }

  const unregisterQueueHooks = () => {
    if (!queueHooksRegistered || !syncQueueTable) {
      queueHooksRegistered = false
      syncQueueTable = null
      queueSize.value = 0
      return
    }

    syncQueueTable.hook('creating').unsubscribe(handleQueueChange)
    syncQueueTable.hook('deleting').unsubscribe(handleQueueChange)
    syncQueueTable.hook('updating').unsubscribe(handleQueueChange)
    syncQueueTable = null
    queueHooksRegistered = false
    queueSize.value = 0
  }

  const syncOnlineStateFromNavigator = () => {
    if (typeof navigator !== 'undefined') {
      isOnline.value = navigator.onLine
    }
  }

  const initNetworkListener = () => {
    if (!initialized) {
      initialized = true

      if (typeof window !== 'undefined') {
        syncOnlineStateFromNavigator()
        window.addEventListener('online', handleOnline)
        window.addEventListener('offline', handleOffline)
      }
    }

    registerQueueHooks()
    void refreshQueueSize()
  }

  const disposeNetworkListener = () => {
    if (!initialized) {
      return
    }

    if (queueRefreshTimer) {
      clearTimeout(queueRefreshTimer)
      queueRefreshTimer = null
    }

    unregisterQueueHooks()

    if (typeof window !== 'undefined') {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }

    initialized = false
  }

  return {
    isOnline,
    queueSize,
    refreshQueueSize,
    initNetworkListener,
    disposeNetworkListener,
  }
})
