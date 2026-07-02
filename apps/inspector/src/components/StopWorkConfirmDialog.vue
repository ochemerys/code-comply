<script setup lang="ts">
/**
 * StopWorkConfirmDialog — mobile-first confirmation before issuing a Stop Work order (M6-S15).
 */
import { BottomSheet } from '@codecomply/ui'
import { computed } from 'vue'
import type { LocalDeficiency } from '@/lib/db/types'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    deficiency: LocalDeficiency | null
    confirming?: boolean
    error?: string | null
  }>(),
  { confirming: false, error: null },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'confirm'): void
  (e: 'cancel'): void
}>()

const isVisible = computed(() => props.modelValue && props.deficiency != null)

function close() {
  emit('update:modelValue', false)
}

function onCancel() {
  emit('cancel')
  close()
}

function onConfirm() {
  if (props.confirming) return
  emit('confirm')
}

function onSheetModelUpdate(open: boolean) {
  if (!open && !props.confirming) close()
}

function onSheetClose() {
  if (!props.confirming) emit('cancel')
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

const summaryDescription = computed(() => {
  const d = props.deficiency?.description?.trim() ?? ''
  if (!d) return '—'
  const max = 200
  return d.length > max ? `${d.slice(0, max)}…` : d
})
</script>

<template>
  <BottomSheet
    v-if="isVisible && deficiency"
    :model-value="isVisible"
    :dismissible="!confirming"
    role="alertdialog"
    labelled-by="stop-work-dialog-title"
    described-by="stop-work-dialog-desc"
    overlay-test-id="stop-work-dialog-overlay"
    data-testid="stop-work-confirm-dialog"
    @update:model-value="onSheetModelUpdate"
    @close="onSheetClose"
  >
    <div class="flex-shrink-0 border-b border-border-subtle px-5 py-4">
      <h2
        id="stop-work-dialog-title"
        class="text-lg font-semibold text-gray-900 dark:text-gray-100"
        data-testid="stop-work-dialog-title"
      >
        Issue Stop Work order?
      </h2>
      <p
        id="stop-work-dialog-desc"
        class="mt-2 text-sm leading-relaxed text-text-secondary"
        data-testid="stop-work-dialog-message"
      >
        This flags the site for immediate safety escalation. A notification is sent right away when
        you are online, or queued for immediate sync when offline. Clearing Stop Work is not
        available in the field—only an administrator can reverse it after review.
      </p>
    </div>

    <div class="px-5 py-4" data-testid="stop-work-dialog-summary">
      <p class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
        Deficiency
      </p>
      <div class="mt-2 flex flex-wrap items-center gap-2">
        <span
          class="inline-flex min-h-[44px] items-center rounded-lg px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ring-1 ring-inset"
          :class="severityBadgeClass(deficiency.severity)"
          data-testid="stop-work-dialog-severity"
        >
          {{ severityLabel(deficiency.severity) }}
        </span>
      </div>
      <p
        class="mt-3 whitespace-pre-wrap text-base leading-snug text-gray-900 dark:text-gray-100"
        data-testid="stop-work-dialog-description"
      >
        {{ summaryDescription }}
      </p>
      <p class="mt-2 text-sm text-gray-600 dark:text-gray-300">
        <span class="font-medium text-gray-800 dark:text-gray-200">Location:</span>
        {{ deficiency.location?.trim() || '—' }}
      </p>
    </div>

    <p
      v-if="error"
      class="mx-5 mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
      data-testid="stop-work-dialog-error"
      role="alert"
    >
      {{ error }}
    </p>

    <div
      class="flex flex-col gap-3 border-t border-border-subtle px-5 py-4 tablet:flex-row tablet:flex-row-reverse"
    >
      <button
        type="button"
        class="h-12 min-h-[44px] flex-1 rounded-lg bg-red-600 px-4 text-base font-semibold text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
        data-testid="stop-work-dialog-confirm"
        :disabled="confirming"
        :aria-busy="confirming"
        @click="onConfirm"
      >
        <span v-if="confirming" data-testid="stop-work-dialog-confirming">Issuing…</span>
        <span v-else>Issue Stop Work</span>
      </button>
      <button
        type="button"
        class="h-12 min-h-[44px] flex-1 rounded-lg border border-border-subtle bg-bg-elevated px-4 text-sm font-medium text-gray-900 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-gray-100 dark:hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        data-testid="stop-work-dialog-cancel"
        :disabled="confirming"
        @click="onCancel"
      >
        Cancel
      </button>
    </div>
  </BottomSheet>
</template>
