<script setup lang="ts">
/**
 * DeficiencyCard — tablet-first summary row for deficiency list (M6-S8).
 * Links to detail view (M6-S9).
 */
import { RouterLink } from 'vue-router'
import type { LocalDeficiency } from '@/lib/db/types'

const props = withDefaults(
  defineProps<{
    deficiency: LocalDeficiency
    /** Max characters before description ellipsis */
    descriptionMax?: number
  }>(),
  { descriptionMax: 120 },
)

function truncate(text: string, max: number): string {
  const t = text.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1)}…`
}

function formatDate(iso: string | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
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
</script>

<template>
  <RouterLink
    class="block rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
    :to="{
      name: 'deficiency-detail',
      params: { inspectionId: deficiency.inspectionId, deficiencyId: deficiency.id },
    }"
    :data-testid="'deficiency-card-link-' + deficiency.id"
  >
    <article
      class="rounded-2xl border p-4 shadow-sm dark:shadow-none"
      :class="
        deficiency.isUnsafe
          ? 'border-red-400 bg-red-50/40 ring-2 ring-red-200 dark:border-red-700 dark:bg-red-950/25 dark:ring-red-900'
          : 'border-border-subtle bg-bg-elevated'
      "
      :data-testid="'deficiency-card-' + deficiency.id"
      role="listitem"
    >
      <div class="flex flex-wrap items-start justify-between gap-2">
        <div class="flex flex-wrap items-center gap-2">
          <span
            class="inline-flex min-h-[44px] items-center rounded-lg px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ring-1 ring-inset"
            :class="severityBadgeClass(deficiency.severity)"
            data-testid="deficiency-card-severity"
          >
            {{ severityLabel(deficiency.severity) }}
          </span>
          <span
            class="inline-flex min-h-[44px] items-center rounded-lg px-2.5 py-1 text-xs font-semibold ring-1 ring-inset"
            :class="statusBadgeClass(deficiency.status)"
            data-testid="deficiency-card-status"
          >
            {{ statusLabel(deficiency.status) }}
          </span>
          <span
            v-if="deficiency.isStopWork"
            class="inline-flex min-h-[44px] items-center rounded-lg bg-red-600 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-white"
            data-testid="deficiency-card-stop-work"
          >
            Stop work
          </span>
          <span
            v-if="deficiency.isUnsafe"
            class="inline-flex min-h-[44px] items-center rounded-lg border border-red-700 bg-red-100 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-red-900 dark:border-red-500 dark:bg-red-950 dark:text-red-100"
            data-testid="deficiency-card-unsafe"
          >
            Unsafe
          </span>
        </div>
      </div>

      <p
        class="mt-3 text-base leading-snug text-gray-900 dark:text-gray-100"
        data-testid="deficiency-card-description"
      >
        {{ truncate(deficiency.description, props.descriptionMax) }}
      </p>

      <dl class="mt-4 grid gap-2 text-sm text-gray-600 dark:text-gray-300">
        <div class="flex flex-wrap gap-x-2">
          <dt class="font-medium text-gray-700 dark:text-gray-200">Location</dt>
          <dd data-testid="deficiency-card-location">
            {{ deficiency.location?.trim() || '—' }}
          </dd>
        </div>
        <div class="flex flex-wrap gap-x-2">
          <dt class="font-medium text-gray-700 dark:text-gray-200">Due</dt>
          <dd data-testid="deficiency-card-due">
            {{ formatDate(deficiency.dueDate) }}
          </dd>
        </div>
        <div class="flex flex-wrap gap-x-2">
          <dt class="font-medium text-gray-700 dark:text-gray-200">Created</dt>
          <dd data-testid="deficiency-card-created">
            {{ formatDate(deficiency.createdAt) }}
          </dd>
        </div>
      </dl>
    </article>
  </RouterLink>
</template>
