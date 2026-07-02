import SyncStatusBanner from './SyncStatusBanner.vue'
import type { SyncStatusState } from '@/composables/useSyncStatus'

interface StoryArgs {
  statusOverride: SyncStatusState
  pendingCountOverride: number
  failedCountOverride: number
  lastErrorOverride: string | null
  syncingOverride: boolean
  fixed: boolean
  showWhenOnline: boolean
}

const meta: Record<string, unknown> = {
  title: 'Inspector/SyncStatusBanner',
  component: SyncStatusBanner,
  args: {
    fixed: false,
    showWhenOnline: true,
  },
}

export default meta

function render(args: StoryArgs): Record<string, unknown> {
  return {
    components: { SyncStatusBanner },
    setup() {
      return { args }
    },
    template: `
      <div class="min-h-40 bg-bg-app p-6">
        <SyncStatusBanner v-bind="args" />
      </div>
    `,
  }
}

export const Offline = {
  render,
  args: {
    statusOverride: 'offline',
    pendingCountOverride: 0,
    failedCountOverride: 0,
    lastErrorOverride: null,
    syncingOverride: false,
    fixed: false,
    showWhenOnline: true,
  },
}

export const Syncing = {
  render,
  args: {
    statusOverride: 'syncing',
    pendingCountOverride: 4,
    failedCountOverride: 0,
    lastErrorOverride: null,
    syncingOverride: true,
    fixed: false,
    showWhenOnline: true,
  },
}

export const QueueStuck = {
  render,
  args: {
    statusOverride: 'online',
    pendingCountOverride: 7,
    failedCountOverride: 3,
    lastErrorOverride: null,
    syncingOverride: false,
    fixed: false,
    showWhenOnline: true,
  },
}

export const Error = {
  render,
  args: {
    statusOverride: 'error',
    pendingCountOverride: 2,
    failedCountOverride: 1,
    lastErrorOverride: 'Server rejected one queued update. Review the failed item and retry.',
    syncingOverride: false,
    fixed: false,
    showWhenOnline: true,
  },
}
