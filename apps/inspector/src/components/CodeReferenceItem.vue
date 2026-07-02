<script setup lang="ts">
import type { CodeReference } from '@/lib/db/types'

const props = withDefaults(
  defineProps<{
    item: CodeReference
    /** Distinct ids when multiple identical codes appear in one list */
    suffix?: string
  }>(),
  { suffix: '' },
)

const emit = defineEmits<{
  select: []
}>()

const testIdSuffix = `${props.item.code}-${props.item.section}`.replace(/[^a-zA-Z0-9]+/g, '-')
</script>

<template>
  <button
    type="button"
    class="w-full text-left min-h-touch px-4 py-3 rounded-xl border border-border-subtle bg-bg-surface text-text-primary hover:bg-gray-50 dark:hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary active:scale-[0.99] transition-transform duration-150"
    :data-testid="`code-reference-item-${testIdSuffix}${suffix ? `-${suffix}` : ''}`"
    @click="emit('select')"
  >
    <div class="font-semibold text-base leading-snug">
      <span data-testid="code-reference-item-code">{{ item.code }}</span>
      <span class="text-text-secondary font-normal mx-1">·</span>
      <span data-testid="code-reference-item-section">{{ item.section }}</span>
    </div>
    <p
      v-if="item.title || item.description"
      class="mt-1.5 text-sm text-text-secondary leading-snug"
      data-testid="code-reference-item-description"
    >
      {{ item.description ?? item.title }}
    </p>
  </button>
</template>
