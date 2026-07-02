<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type {
  CodeReferenceDTO,
  CreateDeficiencyDTO,
  DeficiencyDTO,
  DeficiencySeverity,
  DeficiencyStatus,
  UpdateDeficiencyDTO,
} from '@codecomply/validators'
import CodeReferencePicker from './CodeReferencePicker.vue'

const props = withDefaults(
  defineProps<{
    variant: 'create' | 'edit'
    inspectionId?: string
    initial?: DeficiencyDTO
    submitting?: boolean
    readOnly?: boolean
  }>(),
  {
    inspectionId: undefined,
    initial: undefined,
    submitting: false,
    readOnly: false,
  },
)

const emit = defineEmits<{
  (e: 'submit', value: CreateDeficiencyDTO | UpdateDeficiencyDTO): void
  (e: 'cancel'): void
}>()

const description = ref('')
const severity = ref<DeficiencySeverity>('MINOR')
const location = ref('')
const dueDateInput = ref('')
const codeReference = ref<CodeReferenceDTO | undefined>(undefined)
const status = ref<DeficiencyStatus>('OPEN')
const isStopWork = ref(false)
const isUnsafe = ref(false)
const formError = ref('')

const statusEditable = computed(
  () => props.variant === 'edit' && props.initial && props.initial.status !== 'CLOSED',
)

const stopWorkLocked = computed(
  () => props.variant === 'edit' && props.initial?.isStopWork === true,
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

function ymdToIsoDue(ymd: string): string | undefined {
  if (!ymd.trim()) return undefined
  return new Date(`${ymd}T12:00:00.000Z`).toISOString()
}

function hydrate() {
  if (props.variant === 'edit' && props.initial) {
    description.value = props.initial.description
    severity.value = props.initial.severity
    location.value = props.initial.location ?? ''
    dueDateInput.value = isoDueToYmd(props.initial.dueDate)
    codeReference.value = props.initial.codeReference
    status.value = props.initial.status
    isStopWork.value = props.initial.isStopWork
    isUnsafe.value = props.initial.isUnsafe
  }
}

watch(() => props.initial, hydrate, { immediate: true })

function onSubmit() {
  formError.value = ''
  const desc = description.value.trim()
  if (desc.length < 10) {
    formError.value = 'Description must be at least 10 characters.'
    return
  }

  if (props.variant === 'create') {
    if (!props.inspectionId) {
      formError.value = 'Inspection is required.'
      return
    }
    const payload: CreateDeficiencyDTO = {
      clientId: crypto.randomUUID(),
      inspectionId: props.inspectionId,
      description: desc,
      severity: severity.value,
      isStopWork: isStopWork.value,
      isUnsafe: isUnsafe.value,
      ...(location.value.trim() ? { location: location.value.trim() } : {}),
      ...(codeReference.value ? { codeReference: codeReference.value } : {}),
      ...(ymdToIsoDue(dueDateInput.value) ? { dueDate: ymdToIsoDue(dueDateInput.value) } : {}),
    }
    emit('submit', payload)
    return
  }

  const updates: UpdateDeficiencyDTO = {
    description: desc,
    severity: severity.value,
    isStopWork: isStopWork.value,
    isUnsafe: isUnsafe.value,
    location: location.value.trim() || undefined,
    codeReference: codeReference.value,
    dueDate: ymdToIsoDue(dueDateInput.value),
    ...(statusEditable.value ? { status: status.value } : {}),
  }
  emit('submit', updates)
}
</script>

<template>
  <form class="space-y-4" data-testid="admin-deficiency-form" @submit.prevent="onSubmit">
    <div>
      <label for="def-form-description" class="mb-1 block text-sm font-medium text-text-secondary">
        Description
      </label>
      <textarea
        id="def-form-description"
        v-model="description"
        rows="4"
        required
        class="w-full rounded-lg border border-border-strong px-3 py-2 text-sm"
        data-testid="deficiency-form-description"
        :disabled="readOnly || submitting"
      />
    </div>

    <div class="grid gap-4 sm:grid-cols-2">
      <div>
        <label for="def-form-severity" class="mb-1 block text-sm font-medium text-text-secondary">
          Severity
        </label>
        <select
          id="def-form-severity"
          v-model="severity"
          class="w-full rounded-lg border border-border-strong px-3 py-2 text-sm"
          data-testid="deficiency-form-severity"
          :disabled="readOnly || submitting"
        >
          <option value="MINOR">Minor</option>
          <option value="MAJOR">Major</option>
          <option value="CRITICAL">Critical</option>
        </select>
      </div>
      <div>
        <label for="def-form-due" class="mb-1 block text-sm font-medium text-text-secondary">
          Due date
        </label>
        <input
          id="def-form-due"
          v-model="dueDateInput"
          type="date"
          class="w-full rounded-lg border border-border-strong px-3 py-2 text-sm"
          data-testid="deficiency-form-due-date"
          :disabled="readOnly || submitting"
        />
      </div>
    </div>

    <div v-if="statusEditable">
      <label for="def-form-status" class="mb-1 block text-sm font-medium text-text-secondary">
        Status
      </label>
      <select
        id="def-form-status"
        v-model="status"
        class="w-full rounded-lg border border-border-strong px-3 py-2 text-sm"
        data-testid="deficiency-form-status"
        :disabled="readOnly || submitting"
      >
        <option value="OPEN">Open</option>
        <option value="VOC_SUBMITTED">VoC pending review</option>
        <option value="VOC_ACCEPTED">VoC accepted</option>
        <option value="VOC_REJECTED">VoC rejected</option>
        <option value="CLOSED">Resolved</option>
      </select>
    </div>

    <div>
      <label for="def-form-location" class="mb-1 block text-sm font-medium text-text-secondary">
        Location (optional)
      </label>
      <input
        id="def-form-location"
        v-model="location"
        type="text"
        class="w-full rounded-lg border border-border-strong px-3 py-2 text-sm"
        data-testid="deficiency-form-location"
        :disabled="readOnly || submitting"
      />
    </div>

    <div>
      <span class="mb-1 block text-sm font-medium text-text-secondary">Code reference</span>
      <CodeReferencePicker v-model="codeReference" :disabled="readOnly || submitting" />
    </div>

    <div class="flex flex-wrap gap-4">
      <label class="inline-flex items-center gap-2 text-sm text-text-primary">
        <input
          v-model="isUnsafe"
          type="checkbox"
          data-testid="deficiency-form-unsafe"
          :disabled="readOnly || submitting"
        />
        Unsafe condition
      </label>
      <label class="inline-flex items-center gap-2 text-sm text-text-primary">
        <input
          v-model="isStopWork"
          type="checkbox"
          data-testid="deficiency-form-stop-work"
          :disabled="readOnly || submitting || stopWorkLocked"
        />
        Stop Work
        <span v-if="stopWorkLocked" class="text-text-dim">(issued)</span>
      </label>
    </div>

    <p
      v-if="formError"
      class="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
      role="alert"
    >
      {{ formError }}
    </p>

    <div v-if="!readOnly" class="flex flex-wrap gap-3">
      <button
        type="submit"
        class="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
        data-testid="deficiency-form-submit"
        :disabled="submitting"
      >
        {{ submitting ? 'Saving…' : variant === 'create' ? 'Create deficiency' : 'Save changes' }}
      </button>
      <button
        type="button"
        class="rounded-lg border border-border-strong px-4 py-2 text-sm font-medium text-text-primary"
        data-testid="deficiency-form-cancel"
        :disabled="submitting"
        @click="emit('cancel')"
      >
        Cancel
      </button>
    </div>
  </form>
</template>
