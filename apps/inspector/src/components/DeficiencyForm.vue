<script setup lang="ts">
/**
 * DeficiencyForm — mobile-first create / edit form (M6-S7, M6-S9).
 * Validates with CreateDeficiencyDTO shape (minus clientId); parent supplies clientId for mutations.
 */
import { computed, ref, watch } from 'vue'
import type { CreateDeficiencyDTO, CodeReferenceDTO } from '@codecomply/validators'
import type { CodeReference, LocalDeficiency } from '@/lib/db/types'
import CodeReferenceModal from '@/components/CodeReferenceModal.vue'
import SeveritySelector from '@/components/SeveritySelector.vue'
import UnsafeToggle from '@/components/UnsafeToggle.vue'
import VoiceInputButton from '@/components/VoiceInputButton.vue'
import {
  DeficiencyFormPayloadSchema,
  type DeficiencyFormPayload,
} from '@/components/deficiency-form.types'

const props = withDefaults(
  defineProps<{
    inspectionId: string
    checklistItemId?: string
    /** When true, submit control is disabled (e.g. mutation in flight) */
    submitting?: boolean
    /** When true, form is view-only regardless of mutation state (M8-S10). */
    readOnly?: boolean
    variant?: 'create' | 'edit'
    /** When editing, seed fields from the current deficiency row */
    initialDeficiency?: LocalDeficiency
    /** When creating, pre-fill code reference (e.g. from checklist FAIL flow — M6-S13) */
    initialCreateCodeReference?: CodeReferenceDTO
  }>(),
  {
    checklistItemId: undefined,
    submitting: false,
    readOnly: false,
    variant: 'create',
    initialDeficiency: undefined,
    initialCreateCodeReference: undefined,
  },
)

const emit = defineEmits<{
  (e: 'submit', value: DeficiencyFormPayload): void
  (e: 'cancel'): void
}>()

const description = ref('')
const severity = ref<CreateDeficiencyDTO['severity']>('MINOR')
const location = ref('')
const dueDateInput = ref('') // YYYY-MM-DD from <input type="date">
const codeReference = ref<CodeReferenceDTO | undefined>(undefined)
const codeModalOpen = ref(false)

const isStopWork = ref(false)
const isUnsafe = ref(false)
/** YYYY-MM-DD loaded from server — unchanged past due dates stay valid in edit mode */
const initialDueDateYmd = ref('')

const descriptionError = ref('')
const dueDateError = ref('')
const formError = ref('')

const codeSummary = computed(() => {
  const c = codeReference.value
  if (!c) return ''
  return c.title ? `${c.code} §${c.section} — ${c.title}` : `${c.code} §${c.section}`
})

const submitButtonLabel = computed(() => {
  if (props.submitting) return 'Saving…'
  return props.variant === 'edit' ? 'Save changes' : 'Save deficiency'
})

/** Stop Work cannot be cleared in the field once issued (M6-S15). */
const stopWorkLocked = computed(
  () => props.variant === 'edit' && props.initialDeficiency?.isStopWork === true,
)

function isoDueToYmd(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function hydrateFromInitial(row: LocalDeficiency | undefined) {
  if (!row || props.variant !== 'edit') return
  description.value = row.description ?? ''
  severity.value = row.severity
  location.value = row.location?.trim() ?? ''
  const ymd = isoDueToYmd(row.dueDate)
  dueDateInput.value = ymd
  initialDueDateYmd.value = ymd
  codeReference.value = row.codeReference
    ? {
        code: row.codeReference.code,
        section: row.codeReference.section,
        title: row.codeReference.title,
      }
    : undefined
  isStopWork.value = row.isStopWork
  isUnsafe.value = row.isUnsafe
}

watch(
  () => props.initialDeficiency,
  (row) => hydrateFromInitial(row),
  { immediate: true },
)

watch(
  () => props.variant,
  () => {
    if (props.variant === 'edit') hydrateFromInitial(props.initialDeficiency)
    else {
      initialDueDateYmd.value = ''
      isStopWork.value = false
      isUnsafe.value = false
    }
  },
)

watch(
  () => props.initialCreateCodeReference,
  (c) => {
    if (props.variant !== 'create' || !c) return
    codeReference.value = {
      code: c.code,
      section: c.section,
      ...(c.title ? { title: c.title } : {}),
    }
  },
  { immediate: true },
)

function startOfTodayLocal(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function dueDateToIso(dateYmd: string): string | undefined {
  if (!dateYmd) return undefined
  // Noon UTC avoids previous-day skew for most locales when storing calendar picks
  return `${dateYmd}T12:00:00.000Z`
}

function validateDueDateFuture(dateYmd: string): string | null {
  if (!dateYmd) return null
  if (props.variant === 'edit' && dateYmd === initialDueDateYmd.value) return null
  const chosen = new Date(dateYmd + 'T00:00:00')
  if (Number.isNaN(chosen.getTime())) return 'Enter a valid date.'
  if (chosen <= startOfTodayLocal()) return 'Due date must be in the future.'
  return null
}

function onSelectCode(ref: CodeReference) {
  if (props.readOnly) return
  codeReference.value = {
    code: ref.code,
    section: ref.section,
    title: ref.title,
  }
}

function clearCodeReference() {
  if (props.readOnly) return
  codeReference.value = undefined
}

function onSubmit() {
  if (props.readOnly) return
  descriptionError.value = ''
  dueDateError.value = ''
  formError.value = ''

  const dueIso = dueDateInput.value ? dueDateToIso(dueDateInput.value) : undefined
  const dueErr = validateDueDateFuture(dueDateInput.value)
  if (dueErr) {
    dueDateError.value = dueErr
    return
  }

  const payloadRaw: DeficiencyFormPayload = {
    inspectionId: props.inspectionId,
    checklistItemId: props.checklistItemId || undefined,
    description: description.value.trim(),
    location: location.value.trim() || undefined,
    severity: severity.value,
    codeReference: codeReference.value,
    dueDate: dueIso,
    isStopWork: stopWorkLocked.value ? true : isStopWork.value,
    isUnsafe: isUnsafe.value,
  }

  const parsed = DeficiencyFormPayloadSchema.safeParse(payloadRaw)
  if (!parsed.success) {
    const issues = parsed.error.flatten().fieldErrors
    if (issues.description?.length)
      descriptionError.value = issues.description[0] ?? 'Invalid description.'
    if (issues.severity?.length) formError.value = issues.severity[0] ?? ''
    if (issues.codeReference?.length) formError.value = issues.codeReference[0] ?? ''
    if (!descriptionError.value && !formError.value) {
      formError.value = 'Please fix the highlighted fields.'
    }
    return
  }

  emit('submit', parsed.data)
}

function onCancel() {
  emit('cancel')
}

/** M7-S14 — append Web Speech transcript into description (spacing when joining with existing text). */
function onVoiceTranscript(text: string) {
  if (props.readOnly) return
  const t = text.trim()
  if (!t) return
  const prefix = description.value
  const needsSpace = prefix.length > 0 && !/\s$/.test(prefix)
  description.value = needsSpace ? `${prefix} ${t}` : `${prefix}${t}`
  if (description.value.trim().length >= 10) descriptionError.value = ''
}
</script>

<template>
  <form class="flex flex-col gap-5" data-testid="deficiency-form" @submit.prevent="onSubmit">
    <div class="flex flex-col gap-1.5">
      <div class="flex items-center justify-between gap-2">
        <label
          for="deficiency-description"
          class="text-sm font-medium text-gray-900 dark:text-gray-100"
        >
          Description <span class="text-red-600 dark:text-red-400" aria-hidden="true">*</span>
        </label>
        <VoiceInputButton :disabled="submitting || readOnly" @transcript="onVoiceTranscript" />
      </div>
      <textarea
        id="deficiency-description"
        v-model="description"
        required
        minlength="10"
        rows="4"
        class="min-h-[6rem] w-full rounded-lg border border-border-subtle bg-bg-elevated px-4 py-3 text-base text-gray-900 shadow-sm placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-gray-100 dark:placeholder:text-gray-400 dark:shadow-none"
        placeholder="Describe the deficiency (minimum 10 characters)"
        autocomplete="off"
        data-testid="deficiency-description"
        :disabled="readOnly"
        :class="readOnly ? 'cursor-not-allowed opacity-75' : ''"
        :aria-invalid="Boolean(descriptionError)"
        :aria-describedby="descriptionError ? 'deficiency-description-error' : undefined"
      />
      <p
        v-if="descriptionError"
        id="deficiency-description-error"
        class="text-sm text-red-600 dark:text-red-400"
        data-testid="deficiency-description-error"
      >
        {{ descriptionError }}
      </p>
      <p v-else class="text-xs text-gray-500 dark:text-gray-400">
        Required — at least 10 characters.
      </p>
    </div>

    <div class="flex flex-col gap-1.5">
      <div
        id="deficiency-severity-label"
        class="text-sm font-medium text-gray-900 dark:text-gray-100"
      >
        Severity <span class="text-red-600 dark:text-red-400" aria-hidden="true">*</span>
      </div>
      <SeveritySelector
        v-model="severity"
        aria-labelledby="deficiency-severity-label"
        data-testid="deficiency-severity"
        :disabled="submitting || readOnly"
      />
    </div>

    <div class="flex flex-col gap-2">
      <span class="text-sm font-medium text-gray-900 dark:text-gray-100">Code reference</span>
      <div class="flex flex-wrap items-center gap-2">
        <button
          type="button"
          class="h-12 min-h-[44px] rounded-lg border border-border-subtle bg-bg-elevated px-4 text-base font-medium text-gray-900 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-gray-100 dark:hover:bg-slate-800"
          data-testid="deficiency-code-open"
          :disabled="readOnly"
          :class="readOnly ? 'cursor-not-allowed opacity-50' : ''"
          @click="codeModalOpen = true"
        >
          {{ codeReference ? 'Change code' : 'Select code' }}
        </button>
        <button
          v-if="codeReference"
          type="button"
          class="h-12 min-h-[44px] rounded-lg px-4 text-base text-red-600 hover:underline focus:outline-none focus:ring-2 focus:ring-red-500 dark:text-red-400"
          data-testid="deficiency-code-clear"
          :disabled="readOnly"
          :class="readOnly ? 'cursor-not-allowed opacity-50' : ''"
          @click="clearCodeReference"
        >
          Clear
        </button>
      </div>
      <p
        v-if="codeSummary"
        class="text-sm text-gray-600 dark:text-gray-300"
        data-testid="deficiency-code-summary"
      >
        {{ codeSummary }}
      </p>
      <p v-else class="text-xs text-gray-500 dark:text-gray-400">
        Optional — link to safety code section.
      </p>
    </div>

    <div class="flex flex-col gap-1.5">
      <label for="deficiency-location" class="text-sm font-medium text-gray-900 dark:text-gray-100">
        Location
      </label>
      <input
        id="deficiency-location"
        v-model="location"
        type="text"
        class="h-12 w-full rounded-lg border border-border-subtle bg-bg-elevated px-4 text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-gray-100 dark:shadow-none"
        placeholder="e.g. Unit 3 — electrical room"
        data-testid="deficiency-location"
        :disabled="readOnly"
        :class="readOnly ? 'cursor-not-allowed opacity-75' : ''"
      />
    </div>

    <div class="flex flex-col gap-1.5">
      <label for="deficiency-due-date" class="text-sm font-medium text-gray-900 dark:text-gray-100">
        Due date
      </label>
      <input
        id="deficiency-due-date"
        v-model="dueDateInput"
        type="date"
        class="h-12 w-full rounded-lg border border-border-subtle bg-bg-elevated px-4 text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-gray-100 dark:shadow-none"
        data-testid="deficiency-due-date"
        :disabled="readOnly"
        :class="readOnly ? 'cursor-not-allowed opacity-75' : ''"
        :aria-invalid="Boolean(dueDateError)"
        :aria-describedby="dueDateError ? 'deficiency-due-date-error' : undefined"
      />
      <p
        v-if="dueDateError"
        id="deficiency-due-date-error"
        class="text-sm text-red-600 dark:text-red-400"
        data-testid="deficiency-due-date-error"
      >
        {{ dueDateError }}
      </p>
      <p v-else class="text-xs text-gray-500 dark:text-gray-400">
        {{
          variant === 'edit'
            ? 'Optional — new dates must be in the future; leave as-is to keep the current due date.'
            : 'Optional — must be a future date.'
        }}
      </p>
    </div>

    <div
      class="flex flex-col gap-3 rounded-xl border border-border-subtle bg-gray-50/80 px-4 py-3 dark:bg-slate-800/50"
    >
      <span class="text-sm font-medium text-gray-900 dark:text-gray-100">Safety flags</span>
      <label
        class="flex min-h-[44px] items-center gap-3 text-base text-gray-900 dark:text-gray-100"
        :class="stopWorkLocked ? 'cursor-not-allowed opacity-90' : 'cursor-pointer'"
      >
        <input
          v-model="isStopWork"
          type="checkbox"
          class="h-5 w-5 rounded border-border-subtle text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed"
          data-testid="deficiency-flag-stop-work"
          :disabled="stopWorkLocked || readOnly"
        />
        <span>Stop work order</span>
      </label>
      <p
        v-if="stopWorkLocked"
        class="text-xs text-gray-600 dark:text-gray-400"
        data-testid="deficiency-flag-stop-work-locked-hint"
      >
        Issued on this record. Use the dedicated Stop Work workflow to escalate new sites; clearing
        this flag requires an administrator.
      </p>
      <UnsafeToggle v-model="isUnsafe" :disabled="submitting || readOnly" />
    </div>

    <p
      v-if="formError"
      class="text-sm text-red-600 dark:text-red-400"
      data-testid="deficiency-form-error"
      role="alert"
    >
      {{ formError }}
    </p>

    <div class="flex flex-col tablet:flex-row gap-3 pt-2">
      <button
        type="submit"
        class="h-12 min-h-[44px] flex-1 rounded-lg bg-blue-600 px-6 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 disabled:opacity-50"
        data-testid="deficiency-submit"
        :disabled="submitting || readOnly"
      >
        {{ submitButtonLabel }}
      </button>
      <button
        type="button"
        class="h-12 min-h-[44px] flex-1 rounded-lg border border-border-subtle bg-bg-elevated px-6 text-base font-medium text-gray-900 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-gray-100 dark:hover:bg-slate-800"
        data-testid="deficiency-cancel"
        :disabled="submitting"
        @click="onCancel"
      >
        Cancel
      </button>
    </div>

    <CodeReferenceModal v-model="codeModalOpen" @select="onSelectCode" />
  </form>
</template>
