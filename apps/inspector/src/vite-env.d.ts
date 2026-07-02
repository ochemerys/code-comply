/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /** Set in Dockerfile.e2e so M7-S18 annotation scenarios can reach /e2e-annotate-photo. */
  readonly VITE_ENABLE_E2E_ROUTES?: string
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default component
}

// Augment vue-router types
import 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    devOnly?: boolean
  }
}
