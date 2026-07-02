<script setup lang="ts">
/**
 * DeficiencyDetails — read-only detail sections + action bar (M6-S9, M6-S15 Stop Work CTA).
 * Evidence photos live in PhotoGallery on DeficiencyDetailView (M7-I1).
 */
import { computed } from 'vue'
import type { LocalDeficiency } from '@/lib/db/types'
import StopWorkButton from '@/components/StopWorkButton.vue'

export interface DeficiencyStatusHistoryEntry {
  at: string
  label: string
  detail: string
  status: LocalDeficiency['status']
}

const props = withDefaults(
  defineProps<{
    deficiency: LocalDeficiency | null
    statusHistory: DeficiencyStatusHistoryEntry[]
    loading?: boolean
    error?: Error | null
    actionBusy?: boolean
  }>(),
  {
    loading: false,
    error: null,
    actionBusy: false,
  },
)

const emit = defineEmits<{
  (e: 'edit'): void
  (e: 'delete-request'): void
  (e: 'mark-resolved'): void
  (e: 'stop-work-request'): void
  (e: 'submit-voc'): void
}>()

const canSubmitVoC = computed(() => {
  const st = props.deficiency?.status
  return st === 'OPEN' || st === 'VOC_REJECTED'
})

const codeLine = computed(() => {
  const c = props.deficiency?.codeReference
  if (!c) return ''
  const parts = [c.code, c.section ? `§${c.section}` : '', c.title].filter(Boolean)
  return parts.join(' — ')
})

function severityLabel(sev: LocalDeficiency['severity']): string {
  switch (sev) {
    case 'MINOR':
      return 'Minor'
    case 'MAJOR':
      return 'Major'
    case 'CRITICAL':
      return 'Critical'
    default:
      return sev
  }
}

function statusLabel(st: LocalDeficiency['status']): string {
  switch (st) {
    case 'OPEN':
      return 'Open'
    case 'VOC_SUBMITTED':
      return 'VOC submitted'
    case 'VOC_ACCEPTED':
      return 'VOC accepted'
    case 'VOC_REJECTED':
      return 'VOC rejected'
    case 'CLOSED':
      return 'Closed'
    default:
      return st
  }
}

function severityBadgeClass(sev: LocalDeficiency['severity']): string {
  switch (sev) {
    case 'CRITICAL':
      return 'bg-red-100 text-red-900 ring-red-200 dark:bg-red-950 dark:text-red-100 dark:ring-red-800'
    case 'MAJOR':
      return 'bg-amber-100 text-amber-950 ring-amber-200 dark:bg-amber-950 dark:text-amber-100 dark:ring-amber-800'
    default:
      return 'bg-slate-100 text-slate-800 ring-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-600'
  }
}

function statusBadgeClass(st: LocalDeficiency['status']): string {
  switch (st) {
    case 'OPEN':
      return 'bg-blue-100 text-blue-900 ring-blue-200 dark:bg-blue-950 dark:text-blue-100 dark:ring-blue-800'
    case 'CLOSED':
      return 'bg-emerald-100 text-emerald-900 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-100 dark:ring-emerald-800'
    case 'VOC_SUBMITTED':
      return 'bg-violet-100 text-violet-900 ring-violet-200 dark:bg-violet-950 dark:text-violet-100 dark:ring-violet-800'
    case 'VOC_ACCEPTED':
      return 'bg-teal-100 text-teal-900 ring-teal-200 dark:bg-teal-950 dark:text-teal-100 dark:ring-teal-800'
    case 'VOC_REJECTED':
      return 'bg-orange-100 text-orange-900 ring-orange-200 dark:bg-orange-950 dark:text-orange-100 dark:ring-orange-800'
    default:
      return 'bg-gray-100 text-gray-900 ring-gray-200 dark:bg-gray-800 dark:text-gray-100 dark:ring-gray-600'
  }
}

function formatDateTime(iso: string | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>

<template>
  <div data-testid="deficiency-details">
    <div
      v-if="loading"
      class="rounded-2xl border border-border-subtle bg-bg-elevated px-4 py-8 text-center text-sm text-gray-600 dark:text-gray-300"
      data-testid="deficiency-detail-loading"
    >
      Loading deficiency…
    </div>

    <p
      v-else-if="error"
      class="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
      data-testid="deficiency-detail-error"
      role="alert"
    >
      {{ error.message }}
    </p>

    <template v-else-if="deficiency">
      <header
        class="rounded-2xl border border-border-subtle bg-bg-elevated p-4 shadow-sm dark:shadow-none"
        data-testid="deficiency-detail-header"
      >
        <div class="flex flex-wrap items-center gap-2">
          <span
            class="inline-flex min-h-[44px] items-center rounded-lg px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ring-1 ring-inset"
            :class="severityBadgeClass(deficiency.severity)"
            data-testid="deficiency-detail-severity"
          >
            {{ severityLabel(deficiency.severity) }}
          </span>
          <span
            class="inline-flex min-h-[44px] items-center rounded-lg px-2.5 py-1 text-xs font-semibold ring-1 ring-inset"
            :class="statusBadgeClass(deficiency.status)"
            data-testid="deficiency-detail-status"
          >
            {{ statusLabel(deficiency.status) }}
          </span>
          <span
            v-if="deficiency.isStopWork"
            class="inline-flex min-h-[44px] items-center rounded-lg bg-red-600 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-white"
            data-testid="deficiency-detail-stop-work"
          >
            Stop work
          </span>
          <span
            v-if="deficiency.isUnsafe"
            class="inline-flex min-h-[44px] items-center rounded-lg border border-red-700 bg-red-100 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-red-900 dark:border-red-500 dark:bg-red-950 dark:text-red-100"
            data-testid="deficiency-detail-unsafe"
          >
            Unsafe condition
          </span>
        </div>
        <p class="mt-3 text-xs text-gray-500 dark:text-gray-400">
          Updated {{ formatDateTime(deficiency.updatedAt) }}
        </p>
      </header>

      <div v-if="!deficiency.isStopWork" class="mt-4" data-testid="deficiency-stop-work-section">
        <StopWorkButton :disabled="actionBusy" @request="emit('stop-work-request')" />
      </div>

      <section
        class="mt-6 rounded-2xl border border-border-subtle bg-bg-elevated p-4 shadow-sm dark:shadow-none"
        aria-labelledby="deficiency-detail-description-heading"
      >
        <h2
          id="deficiency-detail-description-heading"
          class="text-sm font-semibold text-gray-900 dark:text-gray-100"
        >
          Description
        </h2>
        <p
          class="mt-2 whitespace-pre-wrap text-base leading-snug text-gray-900 dark:text-gray-100"
          data-testid="deficiency-detail-description"
        >
          {{ deficiency.description }}
        </p>
      </section>

      <section
        class="mt-4 rounded-2xl border border-border-subtle bg-bg-elevated p-4 shadow-sm dark:shadow-none"
        aria-labelledby="deficiency-detail-location-heading"
      >
        <h2
          id="deficiency-detail-location-heading"
          class="text-sm font-semibold text-gray-900 dark:text-gray-100"
        >
          Location
        </h2>
        <p
          class="mt-2 text-base text-gray-800 dark:text-gray-200"
          data-testid="deficiency-detail-location"
        >
          {{ deficiency.location?.trim() || '—' }}
        </p>
      </section>

      <section
        class="mt-4 rounded-2xl border border-border-subtle bg-bg-elevated p-4 shadow-sm dark:shadow-none"
        aria-labelledby="deficiency-detail-code-heading"
      >
        <h2
          id="deficiency-detail-code-heading"
          class="text-sm font-semibold text-gray-900 dark:text-gray-100"
        >
          Code reference
        </h2>
        <p
          v-if="codeLine"
          class="mt-2 text-base text-gray-800 dark:text-gray-200"
          data-testid="deficiency-detail-code-reference"
        >
          {{ codeLine }}
        </p>
        <p
          v-else
          class="mt-2 text-sm text-gray-500 dark:text-gray-400"
          data-testid="deficiency-detail-code-empty"
        >
          No code reference linked.
        </p>
      </section>

      <section
        class="mt-4 rounded-2xl border border-border-subtle bg-bg-elevated p-4 shadow-sm dark:shadow-none"
        aria-labelledby="deficiency-detail-history-heading"
      >
        <h2
          id="deficiency-detail-history-heading"
          class="text-sm font-semibold text-gray-900 dark:text-gray-100"
        >
          Status history
        </h2>
        <ol class="mt-3 flex flex-col gap-3" data-testid="deficiency-detail-status-history">
          <li
            v-for="(h, i) in statusHistory"
            :key="i"
            class="rounded-lg border border-border-subtle px-3 py-2 text-sm"
          >
            <div class="font-medium text-gray-900 dark:text-gray-100">
              {{ h.label }}
            </div>
            <div class="text-xs text-gray-500 dark:text-gray-400">
              {{ formatDateTime(h.at) }}
            </div>
            <div class="mt-1 text-gray-700 dark:text-gray-300">
              {{ h.detail }}
            </div>
            <div class="mt-1">
              <span
                class="inline-flex rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset"
                :class="statusBadgeClass(h.status)"
              >
                {{ statusLabel(h.status) }}
              </span>
            </div>
          </li>
        </ol>
      </section>

      <section
        class="mt-6 flex flex-col gap-3 border-t border-border-subtle pt-6"
        aria-label="Deficiency actions"
        data-testid="deficiency-detail-actions"
      >
        <div class="flex flex-col gap-3 tablet:flex-row tablet:flex-wrap">
          <button
            v-if="canSubmitVoC"
            type="button"
            class="h-12 min-h-[44px] flex-1 rounded-lg bg-violet-600 px-4 text-sm font-medium text-white hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 disabled:opacity-50"
            data-testid="deficiency-detail-submit-voc"
            :disabled="actionBusy"
            @click="emit('submit-voc')"
          >
            Submit VoC
          </button>
          <button
            type="button"
            class="h-12 min-h-[44px] flex-1 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 disabled:opacity-50"
            data-testid="deficiency-detail-edit"
            :disabled="actionBusy"
            @click="emit('edit')"
          >
            Edit
          </button>
          <button
            type="button"
            class="h-12 min-h-[44px] flex-1 rounded-lg border border-emerald-700/40 bg-emerald-50 px-4 text-sm font-medium text-emerald-900 hover:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-600 dark:bg-emerald-950 dark:text-emerald-100 dark:hover:bg-emerald-900 disabled:opacity-50"
            data-testid="deficiency-detail-mark-resolved"
            :disabled="actionBusy || deficiency.status === 'CLOSED'"
            @click="emit('mark-resolved')"
          >
            Mark resolved
          </button>
          <button
            type="button"
            class="h-12 min-h-[44px] flex-1 rounded-lg border border-red-200 bg-red-50 px-4 text-sm font-medium text-red-800 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500 dark:border-red-900 dark:bg-red-950 dark:text-red-100 dark:hover:bg-red-900 disabled:opacity-50"
            data-testid="deficiency-detail-delete"
            :disabled="actionBusy"
            @click="emit('delete-request')"
          >
            Delete
          </button>
        </div>
      </section>
    </template>
  </div>
</template>
