import { defineAsyncComponent, type Component } from 'vue'
import AsyncLoadingFallback from '@/components/AsyncLoadingFallback.vue'

type VueModule = { default: Component }

/**
 * Lazy-load a heavy Vue SFC with a shared loading fallback (M11-S8).
 */
export function defineLazyComponent(loader: () => Promise<VueModule>) {
  return defineAsyncComponent({
    loader,
    loadingComponent: AsyncLoadingFallback,
    delay: 80,
    timeout: 30_000,
  })
}

/** Dynamic import helper for vue-router route records (M11-S8). */
export function lazyView(loader: () => Promise<VueModule>) {
  return loader
}
