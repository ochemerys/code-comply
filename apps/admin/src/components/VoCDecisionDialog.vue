<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { VoCDTO, VoCDecision } from '@codecomply/validators'

const props = defineProps<{
  open: boolean
  voc: VoCDTO | null
  decision: VoCDecision
  submitting?: boolean
  errorMessage?: string | null
}>()

const emit = defineEmits<{
  (e: 'update:open', v: boolean): void
  (e: 'confirm', payload: { comments: string }): void
}>()

const comments = ref('')

watch(
  () => props.open,
  (v) => {
    if (v) comments.value = ''
  },
)

const title = computed(() => {
  if (!props.voc) return 'Review VoC'
  return props.decision === 'ACCEPTED' ? 'Accept verification' : 'Reject verification'
})

function close() {
  emit('update:open', false)
}

function onConfirm() {
  emit('confirm', { comments: comments.value })
}
</script>

<template>
  <div
    v-if="open && voc"
    class="fixed inset-0 z-50 flex items-center justify-center px-4"
    role="dialog"
    aria-modal="true"
    data-testid="voc-decision-dialog"
    @click.self="close"
  >
    <div class="absolute inset-0 bg-black/40" aria-hidden="true" />
    <div
      class="relative w-full max-w-lg rounded-xl bg-bg-surface shadow-xl border border-border-subtle p-5"
    >
      <div class="flex items-start justify-between gap-3">
        <div>
          <h3 class="text-lg font-semibold text-text-primary">{{ title }}</h3>
          <p class="text-sm text-text-secondary mt-1">{{ voc.title }} — {{ voc.sectionTitle }}</p>
        </div>
        <button
          type="button"
          class="p-2 rounded-lg hover:bg-bg-app text-text-secondary"
          aria-label="Close"
          data-testid="voc-decision-dialog-close"
          :disabled="submitting"
          @click="close"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <p class="mt-4 text-sm text-text-secondary">
        <span class="font-medium text-text-primary">{{ voc.name }}</span>
        · verification date
        {{ new Date(voc.verificationDate).toLocaleDateString() }}
      </p>

      <label class="mt-4 flex flex-col gap-1 text-sm text-text-secondary">
        <span class="font-medium">Comments (optional for accept; recommended for reject)</span>
        <textarea
          v-model="comments"
          rows="4"
          class="rounded-md border border-border-strong px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          data-testid="voc-decision-comments"
          :disabled="submitting"
          placeholder="Notes for the record or feedback to the inspector"
        />
      </label>

      <p
        v-if="errorMessage"
        class="mt-3 text-sm text-red-700"
        role="alert"
        data-testid="voc-decision-error"
      >
        {{ errorMessage }}
      </p>

      <div class="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          class="inline-flex justify-center rounded-lg border border-border-strong bg-bg-surface px-4 py-2 text-sm font-semibold text-text-secondary shadow-sm hover:bg-bg-app disabled:opacity-50"
          data-testid="voc-decision-cancel"
          :disabled="submitting"
          @click="close"
        >
          Cancel
        </button>
        <button
          type="button"
          :class="[
            'inline-flex justify-center rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-50',
            decision === 'ACCEPTED'
              ? 'bg-emerald-600 hover:bg-emerald-700'
              : 'bg-red-600 hover:bg-red-700',
          ]"
          :data-testid="
            decision === 'ACCEPTED' ? 'voc-decision-confirm-accept' : 'voc-decision-confirm-reject'
          "
          :disabled="submitting"
          @click="onConfirm"
        >
          {{ decision === 'ACCEPTED' ? 'Confirm accept' : 'Confirm reject' }}
        </button>
      </div>
    </div>
  </div>
</template>
