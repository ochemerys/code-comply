<script setup lang="ts">
/**
 * OutcomeSelector — Acceptable / Acceptable with Conditions / Refused (M8-S3).
 * Touch-sized radio cards with clear selection and accessible semantics.
 */
import { useId } from 'vue'
import type { LocalInspection } from '@/lib/db/types'

export type OutcomeValue = NonNullable<LocalInspection['outcome']>

withDefaults(
  defineProps<{
    disabled?: boolean
  }>(),
  { disabled: false },
)

const model = defineModel<OutcomeValue | undefined>({ required: true })

const groupName = useId()

type Option = {
  value: OutcomeValue
  label: string
  description: string
  surface: string
  selected: string
}

const options: Option[] = [
  {
    value: 'ACCEPTABLE',
    label: 'Acceptable',
    description: 'Inspection passed with no issues',
    surface:
      'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100',
    selected:
      'ring-2 ring-emerald-600 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 border-emerald-600 bg-emerald-100 dark:bg-emerald-900/60',
  },
  {
    value: 'ACCEPTABLE_WITH_CONDITIONS',
    label: 'Acceptable with Conditions',
    description: 'Passed with minor deficiencies to address',
    surface:
      'border-yellow-300 bg-yellow-50 text-yellow-950 dark:border-yellow-700 dark:bg-yellow-950/50 dark:text-yellow-100',
    selected:
      'ring-2 ring-yellow-500 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 border-yellow-500 bg-yellow-100 dark:bg-yellow-900/60',
  },
  {
    value: 'REFUSED',
    label: 'Refused',
    description: 'Inspection failed, major issues found',
    surface:
      'border-red-300 bg-red-50 text-red-950 dark:border-red-800 dark:bg-red-950/50 dark:text-red-100',
    selected:
      'ring-2 ring-red-600 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 border-red-600 bg-red-100 dark:bg-red-900/60',
  },
]

function optionClasses(opt: Option): string {
  const base =
    'flex w-full min-h-[44px] cursor-pointer items-start justify-between gap-3 rounded-xl border-2 px-4 py-3 text-left shadow-sm transition dark:shadow-none'
  const focus =
    'peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-blue-500'
  const disabled = 'peer-disabled:cursor-not-allowed peer-disabled:opacity-50'
  const active = model.value === opt.value ? opt.selected : opt.surface
  return [base, focus, disabled, active].join(' ')
}
</script>

<template>
  <div role="radiogroup" class="grid grid-cols-1 gap-2 tablet:grid-cols-3">
    <label
      v-for="opt in options"
      :key="opt.value"
      class="block"
      :data-testid="`outcome-option-${opt.value}`"
    >
      <input
        v-model="model"
        type="radio"
        class="peer sr-only"
        :name="groupName"
        :value="opt.value"
        :disabled="disabled"
        :aria-label="opt.label"
      />
      <span :class="optionClasses(opt)">
        <span class="flex flex-col">
          <span class="text-base font-semibold">{{ opt.label }}</span>
          <span class="mt-1 text-sm opacity-90">{{ opt.description }}</span>
        </span>
        <span
          class="mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full border border-current opacity-70"
          aria-hidden="true"
        >
          <span
            class="h-2.5 w-2.5 rounded-full bg-current transition"
            :class="model === opt.value ? 'opacity-100' : 'opacity-0'"
          />
        </span>
      </span>
    </label>
  </div>
</template>
