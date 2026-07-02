<script setup lang="ts">
/**
 * UnsafeToggle — mobile-first switch for isUnsafe (M6-S16).
 * Uses a real checkbox so v-model stays boolean and data-testid stays stable for tests.
 */
const model = defineModel<boolean>({ default: false })

withDefaults(defineProps<{ disabled?: boolean }>(), { disabled: false })
</script>

<template>
  <div
    class="rounded-xl border-2 px-4 py-3 transition-colors"
    :class="
      model
        ? 'border-red-600 bg-red-50/90 dark:border-red-500 dark:bg-red-950/35'
        : 'border-border-subtle bg-bg-elevated dark:bg-slate-900/40'
    "
    data-testid="unsafe-condition-toggle"
  >
    <label
      class="flex min-h-[44px] cursor-pointer items-start justify-between gap-4"
      :class="disabled ? 'cursor-not-allowed opacity-60' : ''"
    >
      <span class="flex min-w-0 flex-1 flex-col gap-0.5">
        <span
          class="text-base font-semibold"
          :class="model ? 'text-red-900 dark:text-red-100' : 'text-gray-900 dark:text-gray-100'"
        >
          Unsafe Condition
        </span>
        <span
          class="text-xs leading-snug"
          :class="
            model ? 'text-red-800/90 dark:text-red-200/90' : 'text-gray-600 dark:text-gray-400'
          "
        >
          Mark if this poses immediate safety risk
        </span>
      </span>

      <span
        class="relative mt-0.5 inline-flex h-8 w-[3.25rem] shrink-0 items-center focus-within:rounded-full focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2 dark:focus-within:ring-offset-slate-900"
      >
        <input
          v-model="model"
          type="checkbox"
          class="sr-only"
          data-testid="deficiency-flag-unsafe"
          :disabled="disabled"
          :aria-label="'Unsafe condition' + (model ? ', on' : ', off')"
        />
        <span
          class="pointer-events-none absolute inset-0 rounded-full transition-colors"
          :class="model ? 'bg-red-600 dark:bg-red-500' : 'bg-gray-300 dark:bg-gray-600'"
          aria-hidden="true"
        />
        <span
          class="pointer-events-none absolute left-0.5 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-white shadow transition-transform duration-200"
          :class="model ? 'translate-x-[1.35rem]' : 'translate-x-0'"
          aria-hidden="true"
        />
      </span>
    </label>
  </div>
</template>
