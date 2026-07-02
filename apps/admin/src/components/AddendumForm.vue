<script setup lang="ts">
import { ref } from 'vue'
import SignaturePad from './SignaturePad.vue'

const props = defineProps<{
  inspectionId: string
  submitting?: boolean
}>()

const emit = defineEmits<{
  submit: [payload: { reason: string; content: string; signature: string }]
  cancel: []
}>()

const reason = ref('')
const content = ref('')
const signature = ref<string | null>(null)
const formError = ref<string | null>(null)

function onSigned(dataUrl: string) {
  signature.value = dataUrl
  if (formError.value === 'Digital signature is required') {
    formError.value = null
  }
}

function onSubmit() {
  formError.value = null
  const trimmedReason = reason.value.trim()
  const trimmedContent = content.value.trim()

  if (!trimmedReason) {
    formError.value = 'Reason is required'
    return
  }
  if (!trimmedContent) {
    formError.value = 'Details are required'
    return
  }
  if (!signature.value) {
    formError.value = 'Digital signature is required'
    return
  }

  emit('submit', {
    reason: trimmedReason,
    content: trimmedContent,
    signature: signature.value,
  })
}
</script>

<template>
  <form
    class="space-y-4 rounded-lg border border-border-subtle bg-bg-surface p-5 shadow-sm"
    data-testid="addendum-form"
    @submit.prevent="onSubmit"
  >
    <h3 class="text-lg font-semibold text-text-primary">Create addendum</h3>
    <p class="text-sm text-text-secondary">
      Addendums amend finalized inspection records. Original record
      <span class="font-mono text-text-primary">{{ inspectionId }}</span> cannot be edited.
    </p>

    <div>
      <label class="block text-sm font-medium text-text-secondary" for="addendum-original">
        Original record
      </label>
      <input
        id="addendum-original"
        type="text"
        class="mt-1 w-full rounded-lg border border-border-subtle bg-bg-app px-3 py-2 font-mono text-sm text-text-secondary"
        :value="inspectionId"
        readonly
        data-testid="addendum-original-id"
      />
    </div>

    <div>
      <label class="block text-sm font-medium text-text-secondary" for="addendum-reason">
        Reason <span class="text-red-600">*</span>
      </label>
      <textarea
        id="addendum-reason"
        v-model="reason"
        rows="3"
        class="mt-1 w-full rounded-lg border border-border-strong px-3 py-2 text-sm"
        placeholder="Why is this addendum required?"
        data-testid="addendum-reason"
        :disabled="submitting"
      />
    </div>

    <div>
      <label class="block text-sm font-medium text-text-secondary" for="addendum-content">
        Details <span class="text-red-600">*</span>
      </label>
      <textarea
        id="addendum-content"
        v-model="content"
        rows="4"
        class="mt-1 w-full rounded-lg border border-border-strong px-3 py-2 text-sm"
        placeholder="Describe the correction or additional information"
        data-testid="addendum-content"
        :disabled="submitting"
      />
    </div>

    <SignaturePad :disabled="submitting" @signed="onSigned" />

    <p v-if="signature" class="text-xs text-green-700" data-testid="addendum-signature-captured">
      Signature captured
    </p>

    <p
      v-if="formError"
      class="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
      role="alert"
      data-testid="addendum-form-error"
    >
      {{ formError }}
    </p>

    <div class="flex flex-wrap gap-3">
      <button
        type="submit"
        class="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
        data-testid="addendum-submit"
        :disabled="submitting"
      >
        Submit addendum
      </button>
      <button
        type="button"
        class="rounded-lg border border-border-strong bg-bg-surface px-4 py-2 text-sm font-semibold text-text-secondary hover:bg-bg-app"
        data-testid="addendum-cancel"
        :disabled="submitting"
        @click="emit('cancel')"
      >
        Cancel
      </button>
    </div>
  </form>
</template>
