<script setup lang="ts">
/**
 * SeveritySelector — reusable Minor / Major / Critical control (M6-S12).
 * Touch-sized segmented options with semantic color cues and native radios for a11y.
 */
import { useId } from 'vue'
import type { CreateDeficiencyDTO } from '@codecomply/validators'

export type SeverityValue = CreateDeficiencyDTO['severity']

withDefaults(
  defineProps<{
    disabled?: boolean
  }>(),
  { disabled: false },
)

const model = defineModel<SeverityValue>({ required: true })

const groupName = useId()

type Option = {
  value: SeverityValue
  label: string
  /** Unselected surface */
  surface: string
  /** Selected ring + emphasis */
  selected: string
}

const options: Option[] = [
  {
    value: 'MINOR',
    label: 'Minor',
    surface:
      'border-yellow-300 bg-yellow-50 text-yellow-950 dark:border-yellow-700 dark:bg-yellow-950/50 dark:text-yellow-100',
    selected:
      'ring-2 ring-yellow-500 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 border-yellow-500 bg-yellow-100 dark:bg-yellow-900/60',
  },
  {
    value: 'MAJOR',
    label: 'Major',
    surface:
      'border-orange-300 bg-orange-50 text-orange-950 dark:border-orange-700 dark:bg-orange-950/50 dark:text-orange-100',
    selected:
      'ring-2 ring-orange-500 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 border-orange-500 bg-orange-100 dark:bg-orange-900/60',
  },
  {
    value: 'CRITICAL',
    label: 'Critical',
    surface:
      'border-red-300 bg-red-50 text-red-950 dark:border-red-800 dark:bg-red-950/50 dark:text-red-100',
    selected:
      'ring-2 ring-red-600 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 border-red-600 bg-red-100 dark:bg-red-900/60',
  },
]

function optionClasses(opt: Option): string {
  const base =
    'flex w-full min-h-[44px] cursor-pointer items-center justify-center rounded-lg border-2 px-4 py-3 text-base font-medium shadow-sm transition dark:shadow-none'
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
      :data-testid="`severity-option-${opt.value}`"
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
        {{ opt.label }}
      </span>
    </label>
  </div>
</template>
