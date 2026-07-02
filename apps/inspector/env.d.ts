/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  readonly VITE_IDLE_WARN_MS?: string
  readonly VITE_IDLE_LOGOUT_MS?: string
  readonly VITE_MAX_OFFLINE_DAYS?: string
  readonly VITE_ENABLE_PWA_DEV?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/ban-types
  const component: DefineComponent<Record<string, never>, Record<string, never>, any>
  export default component
}

// ─── Background Sync API Type Declarations ───────────────────────────────────
// The Background Sync API is not yet included in TypeScript's default lib types.
// @see https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API
// @see M3-S4 - Implement Background Sync API Integration

interface SyncManager {
  register(tag: string): Promise<void>
  getTags(): Promise<string[]>
}

interface ServiceWorkerRegistration {
  readonly sync: SyncManager
}

interface SyncEvent extends ExtendableEvent {
  readonly lastChance: boolean
  readonly tag: string
}

interface Window {
  SyncManager: typeof SyncManager
}
