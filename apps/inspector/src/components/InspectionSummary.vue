<script setup lang="ts">
import { computed } from 'vue'
import type { LocalInspection } from '@/lib/db/types'
import { useAuthStore } from '@/stores/auth'

const props = defineProps<{
  inspection: LocalInspection
}>()

const authStore = useAuthStore()

const scheduledDateLabel = computed(() => {
  const raw = props.inspection.scheduledDate
  const d = raw ? new Date(raw) : null
  if (!d || Number.isNaN(d.getTime())) return raw || '—'
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d)
  } catch {
    return d.toISOString()
  }
})

const inspectorName = computed(() => authStore.user?.name || 'Inspector')
</script>

<template>
  <section
    class="rounded-2xl border border-border-subtle bg-bg-surface p-4 shadow-sm dark:shadow-none tablet:p-6"
    data-testid="inspection-summary"
    aria-label="Inspection summary"
  >
    <header class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <h2 class="text-lg font-semibold text-text-primary" data-testid="inspection-summary-title">
          Inspection summary
        </h2>
        <p class="mt-1 text-sm text-text-secondary" data-testid="inspection-summary-permit">
          Permit:
          <span class="font-medium text-text-primary">
            {{ inspection.permitNumber || '—' }}
          </span>
        </p>
        <p class="mt-1 text-sm text-text-secondary" data-testid="inspection-summary-address">
          Address:
          <span class="font-medium text-text-primary">
            {{ inspection.permitAddress || '—' }}
          </span>
        </p>
      </div>
      <span
        class="inline-flex items-center rounded-full border border-border-subtle bg-bg-elevated px-3 py-1 text-xs font-semibold text-text-primary"
        data-testid="inspection-summary-status"
      >
        {{ inspection.status }}
      </span>
    </header>

    <dl class="mt-4 grid grid-cols-1 gap-3 tablet:grid-cols-3">
      <div class="rounded-xl border border-border-subtle bg-bg-elevated px-4 py-3">
        <dt class="text-xs font-semibold uppercase tracking-wide text-text-secondary">Scheduled</dt>
        <dd
          class="mt-1 text-sm font-medium text-text-primary"
          data-testid="inspection-summary-date"
        >
          {{ scheduledDateLabel }}
        </dd>
      </div>
      <div class="rounded-xl border border-border-subtle bg-bg-elevated px-4 py-3">
        <dt class="text-xs font-semibold uppercase tracking-wide text-text-secondary">Inspector</dt>
        <dd
          class="mt-1 text-sm font-medium text-text-primary"
          data-testid="inspection-summary-inspector"
        >
          {{ inspectorName }}
        </dd>
      </div>
      <div class="rounded-xl border border-border-subtle bg-bg-elevated px-4 py-3">
        <dt class="text-xs font-semibold uppercase tracking-wide text-text-secondary">Duration</dt>
        <dd
          class="mt-1 text-sm font-medium text-text-primary"
          data-testid="inspection-summary-duration"
        >
          {{ inspection.durationSeconds != null ? `${inspection.durationSeconds}s` : '—' }}
        </dd>
      </div>
    </dl>
  </section>
</template>
