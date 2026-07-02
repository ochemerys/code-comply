<script setup lang="ts">
import { computed, ref } from 'vue'

type SubmissionState = 'success' | 'failure'

interface Props {
  state: SubmissionState
  inspectionId?: string
  errorMessage?: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'view-details'): void
  (e: 'start-new'): void
  (e: 'retry'): void
  (e: 'save-for-later'): void
}>()

const copyFeedback = ref<string | null>(null)

const title = computed(() =>
  props.state === 'success' ? 'Inspection submitted successfully' : 'Submission failed',
)

const message = computed(() => {
  if (props.state === 'success') {
    return 'Your inspection is queued for sync. It will upload automatically when you’re online.'
  }
  return props.errorMessage?.trim() || 'We could not queue this submission. Please try again.'
})

const inspectionIdLabel = computed(() => {
  const id = props.inspectionId?.trim()
  return id ? `Inspection ID: ${id}` : ''
})

async function onShareOrCopy() {
  const id = props.inspectionId?.trim()
  if (!id) return

  const shareText = `Inspection ID: ${id}`

  try {
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (navigator as any).share({ title: 'Inspection', text: shareText })
      copyFeedback.value = 'Shared.'
      return
    }
  } catch {
    // fall back to copy
  }

  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(shareText)
      copyFeedback.value = 'Copied to clipboard.'
      return
    }
  } catch {
    // ignore
  }

  copyFeedback.value = 'Unable to share on this device.'
}
</script>

<template>
  <section
    class="rounded-2xl border border-border-subtle bg-bg-surface p-5 shadow-sm dark:shadow-none tablet:p-6"
    :class="
      state === 'success'
        ? 'border-emerald-200 bg-emerald-50/40 dark:border-emerald-900 dark:bg-emerald-950/20'
        : 'border-red-200 bg-red-50/40 dark:border-red-900 dark:bg-red-950/20'
    "
    role="status"
    aria-live="polite"
    data-testid="submission-result"
  >
    <div class="flex items-start gap-3">
      <div
        class="mt-0.5 inline-flex h-10 w-10 flex-none items-center justify-center rounded-xl"
        :class="
          state === 'success' ? 'bg-emerald-600/10 text-emerald-700' : 'bg-red-600/10 text-red-700'
        "
        aria-hidden="true"
        data-testid="submission-result-icon"
      >
        <svg
          v-if="state === 'success'"
          class="h-6 w-6"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M20 6L9 17l-5-5"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        <svg
          v-else
          class="h-6 w-6"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </div>

      <div class="min-w-0 flex-1">
        <h2 class="text-lg font-semibold text-text-primary" data-testid="submission-result-title">
          {{ title }}
        </h2>
        <p class="mt-1 text-sm text-text-secondary" data-testid="submission-result-message">
          {{ message }}
        </p>

        <p
          v-if="inspectionIdLabel"
          class="mt-3 rounded-xl border border-border-subtle bg-bg-elevated px-3 py-2 text-sm font-medium text-text-primary"
          data-testid="submission-result-inspection-id"
        >
          {{ inspectionIdLabel }}
        </p>

        <p
          v-if="copyFeedback"
          class="mt-2 text-xs text-text-secondary"
          data-testid="submission-result-share-feedback"
        >
          {{ copyFeedback }}
        </p>

        <div class="mt-4 flex flex-col gap-2 tablet:flex-row">
          <template v-if="state === 'success'">
            <button
              type="button"
              class="min-h-touch w-full rounded-xl border border-border-subtle bg-bg-surface px-4 text-base font-medium text-text-primary transition-all duration-200 ease-out hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary active:scale-95 dark:hover:bg-slate-800 tablet:w-auto tablet:flex-1"
              data-testid="submission-result-view-details"
              @click="emit('view-details')"
            >
              View details
            </button>
            <button
              type="button"
              class="min-h-touch w-full rounded-xl bg-primary px-4 text-base font-medium text-white transition-all duration-200 ease-out hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 active:scale-95 tablet:w-auto tablet:flex-1"
              data-testid="submission-result-start-new"
              @click="emit('start-new')"
            >
              Start new inspection
            </button>
            <button
              v-if="inspectionId"
              type="button"
              class="min-h-touch w-full rounded-xl border border-border-subtle bg-bg-elevated px-4 text-base font-medium text-text-primary transition-all duration-200 ease-out hover:bg-bg-surface focus:outline-none focus:ring-2 focus:ring-primary active:scale-95 tablet:w-auto"
              data-testid="submission-result-share"
              @click="onShareOrCopy"
            >
              Share / export
            </button>
          </template>

          <template v-else>
            <button
              type="button"
              class="min-h-touch w-full rounded-xl bg-primary px-4 text-base font-medium text-white transition-all duration-200 ease-out hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 active:scale-95 tablet:w-auto tablet:flex-1"
              data-testid="submission-result-retry"
              @click="emit('retry')"
            >
              Retry
            </button>
            <button
              type="button"
              class="min-h-touch w-full rounded-xl border border-border-subtle bg-bg-surface px-4 text-base font-medium text-text-primary transition-all duration-200 ease-out hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary active:scale-95 dark:hover:bg-slate-800 tablet:w-auto tablet:flex-1"
              data-testid="submission-result-save-for-later"
              @click="emit('save-for-later')"
            >
              Save for later
            </button>
          </template>
        </div>
      </div>
    </div>
  </section>
</template>
