<template>
  <button :type="type" :disabled="isDisabled" :class="buttonClasses" @click="handleClick">
    <svg
      v-if="loading"
      class="animate-spin h-4 w-4 shrink-0"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
      <path
        class="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
    <slot />
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

interface Props {
  variant?: Variant
  size?: Size
  type?: 'button' | 'submit' | 'reset'
  disabled?: boolean
  loading?: boolean
  block?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'md',
  type: 'button',
  disabled: false,
  loading: false,
  block: false,
})

const isDisabled = computed(() => props.disabled || props.loading)

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-blue-600 text-white hover:bg-blue-700 shadow-sm dark:shadow-none dark:border dark:border-slate-700',
  secondary:
    'bg-bg-surface border border-border-subtle text-text-primary hover:bg-gray-50 dark:hover:bg-slate-700',
  ghost:
    'bg-transparent hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-700 dark:text-gray-300',
  danger:
    'bg-red-600 text-white hover:bg-red-700 shadow-sm dark:shadow-none dark:border dark:border-red-800',
}

const sizeClasses: Record<Size, string> = {
  sm: 'h-10 px-3 text-sm',
  md: 'h-11 px-4 text-base',
  lg: 'h-touch px-6 text-lg',
}

const buttonClasses = computed(() => [
  'inline-flex items-center justify-center gap-2',
  'rounded-lg font-medium',
  'transition-all duration-200 ease-out',
  'active:scale-95',
  'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500',
  'disabled:opacity-50 disabled:cursor-not-allowed',
  variantClasses[props.variant],
  sizeClasses[props.size],
  { 'w-full': props.block },
])

const emit = defineEmits<{
  click: [event: MouseEvent]
}>()

const handleClick = (event: MouseEvent) => {
  if (!props.disabled && !props.loading) {
    emit('click', event)
  }
}
</script>
