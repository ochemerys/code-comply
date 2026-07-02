<script setup lang="ts">
/**
 * VoCForm — mobile-first Verification of Compliance submission form (M10-S13).
 */
import { computed, ref, watch } from 'vue'
import type { VoCMethod } from '@codecomply/validators'
import { VoCFormPayloadSchema, type VoCFormPayload } from '@/components/voc-form.types'

const props = withDefaults(
  defineProps<{
    submitting?: boolean
    readOnly?: boolean
    /** Pre-fill section title from deficiency code reference */
    initialSectionTitle?: string
    /** Pre-fill title from code reference */
    initialTitle?: string
  }>(),
  {
    submitting: false,
    readOnly: false,
    initialSectionTitle: '',
    initialTitle: '',
  },
)

const emit = defineEmits<{
  (e: 'submit', value: VoCFormPayload): void
  (e: 'cancel'): void
}>()

const verificationDateInput = ref('')
const sectionTitle = ref('')
const title = ref('')
const name = ref('')
const method = ref<VoCMethod>('WRITTEN_ASSURANCE')
const comments = ref('')

const verificationDateError = ref('')
const sectionTitleError = ref('')
const titleError = ref('')
const nameError = ref('')
const methodError = ref('')
const formError = ref('')

const methodOptions: { value: VoCMethod; label: string }[] = [
  { value: 'WRITTEN_ASSURANCE', label: 'Written assurance' },
  { value: 'SITE_VISIT', label: 'Site visit' },
  { value: 'VERBAL_ASSURANCE', label: 'Verbal assurance' },
  { value: 'OTHER', label: 'Other' },
]

const submitButtonLabel = computed(() => (props.submitting ? 'Submitting…' : 'Submit VoC'))

function todayYmd(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function dateYmdToIso(dateYmd: string): string {
  return `${dateYmd}T12:00:00.000Z`
}

watch(
  () => [props.initialSectionTitle, props.initialTitle] as const,
  ([section, vocTitle]) => {
    if (section && !sectionTitle.value) sectionTitle.value = section
    if (vocTitle && !title.value) title.value = vocTitle
  },
  { immediate: true },
)

watch(
  () => props.readOnly,
  () => {
    if (!verificationDateInput.value) verificationDateInput.value = todayYmd()
  },
  { immediate: true },
)

function onSubmit() {
  if (props.readOnly) return
  verificationDateError.value = ''
  sectionTitleError.value = ''
  titleError.value = ''
  nameError.value = ''
  methodError.value = ''
  formError.value = ''

  const payloadRaw: VoCFormPayload = {
    verificationDate: dateYmdToIso(verificationDateInput.value || todayYmd()),
    sectionTitle: sectionTitle.value.trim(),
    title: title.value.trim(),
    name: name.value.trim(),
    method: method.value,
    comments: comments.value.trim() || undefined,
  }

  const parsed = VoCFormPayloadSchema.safeParse(payloadRaw)
  if (!parsed.success) {
    const issues = parsed.error.flatten().fieldErrors
    if (issues.verificationDate?.length) {
      verificationDateError.value = issues.verificationDate[0] ?? 'Invalid verification date.'
    }
    if (issues.sectionTitle?.length) {
      sectionTitleError.value = issues.sectionTitle[0] ?? 'Section title is required.'
    }
    if (issues.title?.length) titleError.value = issues.title[0] ?? 'Title is required.'
    if (issues.name?.length) nameError.value = issues.name[0] ?? 'Name is required.'
    if (issues.method?.length) methodError.value = issues.method[0] ?? 'Select a method.'
    if (
      !verificationDateError.value &&
      !sectionTitleError.value &&
      !titleError.value &&
      !nameError.value &&
      !methodError.value
    ) {
      formError.value = 'Please fix the highlighted fields.'
    }
    return
  }

  emit('submit', parsed.data)
}

function onCancel() {
  emit('cancel')
}
</script>

<template>
  <form class="flex flex-col gap-5" data-testid="voc-form" @submit.prevent="onSubmit">
    <div class="flex flex-col gap-1.5">
      <label
        for="voc-verification-date"
        class="text-sm font-medium text-gray-900 dark:text-gray-100"
      >
        Verification date <span class="text-red-600 dark:text-red-400" aria-hidden="true">*</span>
      </label>
      <input
        id="voc-verification-date"
        v-model="verificationDateInput"
        type="date"
        required
        class="h-12 w-full rounded-lg border border-border-subtle bg-bg-elevated px-4 text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-gray-100 dark:shadow-none"
        data-testid="voc-verification-date"
        :disabled="readOnly"
        :class="readOnly ? 'cursor-not-allowed opacity-75' : ''"
        :aria-invalid="Boolean(verificationDateError)"
        :aria-describedby="verificationDateError ? 'voc-verification-date-error' : undefined"
      />
      <p
        v-if="verificationDateError"
        id="voc-verification-date-error"
        class="text-sm text-red-600 dark:text-red-400"
        data-testid="voc-verification-date-error"
      >
        {{ verificationDateError }}
      </p>
    </div>

    <div class="flex flex-col gap-1.5">
      <label for="voc-section-title" class="text-sm font-medium text-gray-900 dark:text-gray-100">
        Section title <span class="text-red-600 dark:text-red-400" aria-hidden="true">*</span>
      </label>
      <input
        id="voc-section-title"
        v-model="sectionTitle"
        type="text"
        required
        class="h-12 w-full rounded-lg border border-border-subtle bg-bg-elevated px-4 text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-gray-100 dark:shadow-none"
        placeholder="e.g. NBC §9.10.1 — Fire separation"
        data-testid="voc-section-title"
        :disabled="readOnly"
        :class="readOnly ? 'cursor-not-allowed opacity-75' : ''"
        :aria-invalid="Boolean(sectionTitleError)"
        :aria-describedby="sectionTitleError ? 'voc-section-title-error' : undefined"
      />
      <p
        v-if="sectionTitleError"
        id="voc-section-title-error"
        class="text-sm text-red-600 dark:text-red-400"
        data-testid="voc-section-title-error"
      >
        {{ sectionTitleError }}
      </p>
    </div>

    <div class="flex flex-col gap-1.5">
      <label for="voc-title" class="text-sm font-medium text-gray-900 dark:text-gray-100">
        Title <span class="text-red-600 dark:text-red-400" aria-hidden="true">*</span>
      </label>
      <input
        id="voc-title"
        v-model="title"
        type="text"
        required
        class="h-12 w-full rounded-lg border border-border-subtle bg-bg-elevated px-4 text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-gray-100 dark:shadow-none"
        placeholder="Short title for this verification"
        data-testid="voc-title"
        :disabled="readOnly"
        :class="readOnly ? 'cursor-not-allowed opacity-75' : ''"
        :aria-invalid="Boolean(titleError)"
        :aria-describedby="titleError ? 'voc-title-error' : undefined"
      />
      <p
        v-if="titleError"
        id="voc-title-error"
        class="text-sm text-red-600 dark:text-red-400"
        data-testid="voc-title-error"
      >
        {{ titleError }}
      </p>
    </div>

    <div class="flex flex-col gap-1.5">
      <label for="voc-name" class="text-sm font-medium text-gray-900 dark:text-gray-100">
        Submitter name <span class="text-red-600 dark:text-red-400" aria-hidden="true">*</span>
      </label>
      <input
        id="voc-name"
        v-model="name"
        type="text"
        required
        class="h-12 w-full rounded-lg border border-border-subtle bg-bg-elevated px-4 text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-gray-100 dark:shadow-none"
        placeholder="Person providing verification"
        data-testid="voc-name"
        :disabled="readOnly"
        :class="readOnly ? 'cursor-not-allowed opacity-75' : ''"
        :aria-invalid="Boolean(nameError)"
        :aria-describedby="nameError ? 'voc-name-error' : undefined"
      />
      <p
        v-if="nameError"
        id="voc-name-error"
        class="text-sm text-red-600 dark:text-red-400"
        data-testid="voc-name-error"
      >
        {{ nameError }}
      </p>
    </div>

    <div class="flex flex-col gap-1.5">
      <label for="voc-method" class="text-sm font-medium text-gray-900 dark:text-gray-100">
        Verification method <span class="text-red-600 dark:text-red-400" aria-hidden="true">*</span>
      </label>
      <select
        id="voc-method"
        v-model="method"
        required
        class="h-12 w-full rounded-lg border border-border-subtle bg-bg-elevated px-4 text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-gray-100 dark:shadow-none"
        data-testid="voc-method"
        :disabled="readOnly"
        :class="readOnly ? 'cursor-not-allowed opacity-75' : ''"
        :aria-invalid="Boolean(methodError)"
        :aria-describedby="methodError ? 'voc-method-error' : undefined"
      >
        <option v-for="opt in methodOptions" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </option>
      </select>
      <p
        v-if="methodError"
        id="voc-method-error"
        class="text-sm text-red-600 dark:text-red-400"
        data-testid="voc-method-error"
      >
        {{ methodError }}
      </p>
    </div>

    <div class="flex flex-col gap-1.5">
      <label for="voc-comments" class="text-sm font-medium text-gray-900 dark:text-gray-100">
        Comments
      </label>
      <textarea
        id="voc-comments"
        v-model="comments"
        rows="3"
        class="min-h-[5rem] w-full rounded-lg border border-border-subtle bg-bg-elevated px-4 py-3 text-base text-gray-900 shadow-sm placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-gray-100 dark:placeholder:text-gray-400 dark:shadow-none"
        placeholder="Optional notes about how compliance was verified"
        data-testid="voc-comments"
        :disabled="readOnly"
        :class="readOnly ? 'cursor-not-allowed opacity-75' : ''"
      />
    </div>

    <p
      v-if="formError"
      class="text-sm text-red-600 dark:text-red-400"
      data-testid="voc-form-error"
      role="alert"
    >
      {{ formError }}
    </p>

    <div class="flex flex-col tablet:flex-row gap-3 pt-2">
      <button
        type="submit"
        class="h-12 min-h-[44px] flex-1 rounded-lg bg-blue-600 px-6 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 disabled:opacity-50"
        data-testid="voc-submit"
        :disabled="submitting || readOnly"
      >
        {{ submitButtonLabel }}
      </button>
      <button
        type="button"
        class="h-12 min-h-[44px] flex-1 rounded-lg border border-border-subtle bg-bg-elevated px-6 text-base font-medium text-gray-900 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-gray-100 dark:hover:bg-slate-800"
        data-testid="voc-cancel"
        :disabled="submitting"
        @click="onCancel"
      >
        Cancel
      </button>
    </div>
  </form>
</template>
