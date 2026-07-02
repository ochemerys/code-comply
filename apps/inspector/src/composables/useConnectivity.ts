import { computed } from 'vue'
import { useNetworkStore } from '@/stores/network'

export function useConnectivity() {
  const networkStore = useNetworkStore()
  const isConnectionAvailable = computed(() => networkStore.isOnline)

  return {
    isConnectionAvailable,
  }
}
