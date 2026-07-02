<script setup lang="ts">
defineProps<{
  label: string
  value: string | number
  variant?: 'default' | 'danger'
}>()
</script>

<template>
  <div
    class="rounded-lg shadow p-6 bg-bg-surface border"
    :class="variant === 'danger' ? 'border-red-200' : 'border-transparent'"
    data-testid="stats-card"
  >
    <h3 class="text-sm font-medium text-text-dim">
      {{ label }}
    </h3>
    <p
      class="text-3xl font-bold mt-2"
      :class="variant === 'danger' ? 'text-red-700' : 'text-text-primary'"
    >
      {{ value }}
    </p>
  </div>
</template>
