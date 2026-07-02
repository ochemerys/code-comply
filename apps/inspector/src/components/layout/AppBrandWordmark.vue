<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    /** sm: phone header; md: sidebar; lg: login / marketing */
    size?: 'sm' | 'md' | 'lg'
  }>(),
  { size: 'md' },
)

const wordmarkClass = computed(() => {
  switch (props.size) {
    case 'sm':
      return 'text-base sm:text-lg'
    case 'lg':
      return 'text-3xl'
    default:
      return 'text-lg'
  }
})
</script>

<template>
  <span
    :class="[
      'inline-block font-bold text-text-primary tracking-tight whitespace-nowrap min-w-0 max-w-full',
      wordmarkClass,
    ]"
    data-testid="app-brand-wordmark"
  >
    CodeComply Field
  </span>
</template>
