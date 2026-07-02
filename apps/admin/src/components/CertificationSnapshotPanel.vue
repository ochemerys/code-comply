<script setup lang="ts">
import { computed } from 'vue'
import type { InspectionCertificationSnapshot } from '@codecomply/validators'

const props = defineProps<{
  data: InspectionCertificationSnapshot | undefined
  loading?: boolean
  error?: Error | null
}>()

const snapshotJson = computed(() => {
  if (props.data?.snapshot == null) return null
  try {
    return JSON.stringify(props.data.snapshot, null, 2)
  } catch {
    return String(props.data.snapshot)
  }
})
</script>

<template>
  <div data-testid="certification-snapshot-panel" class="space-y-3 text-sm">
    <div
      v-if="loading"
      class="rounded-md border border-border-subtle bg-bg-app px-4 py-3 text-text-secondary"
      data-testid="certification-snapshot-loading"
    >
      Loading certification snapshot…
    </div>

    <div
      v-else-if="error"
      class="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-red-800"
      data-testid="certification-snapshot-error"
    >
      {{ error.message }}
    </div>

    <template v-else-if="data">
      <dl class="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div>
          <dt class="font-medium text-text-dim">Finalized at</dt>
          <dd class="font-mono text-text-primary">{{ data.finalizedAt ?? '—' }}</dd>
        </div>
        <div>
          <dt class="font-medium text-text-dim">Snapshot hash (SHA-256)</dt>
          <dd
            class="break-all font-mono text-xs text-text-primary"
            data-testid="certification-snapshot-hash"
          >
            {{ data.snapshotHash ?? '—' }}
          </dd>
        </div>
      </dl>

      <div v-if="snapshotJson" data-testid="certification-snapshot-json">
        <p class="mb-1 font-medium text-text-secondary">Frozen certification record (read-only)</p>
        <pre
          class="max-h-64 overflow-auto rounded-md border border-border-subtle bg-bg-app p-3 text-xs text-text-primary"
          >{{ snapshotJson }}</pre
        >
      </div>
      <p v-else class="text-text-secondary" data-testid="certification-snapshot-empty">
        No certification snapshot was captured for this inspection.
      </p>
    </template>
  </div>
</template>
