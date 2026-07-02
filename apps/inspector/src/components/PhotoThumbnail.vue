<script setup lang="ts">
/**
 * M7-S13: Touch-friendly thumbnail tile for inspection photo grids (tablet-first).
 */
defineProps<{
  src: string
  alt: string
}>()

const emit = defineEmits<{
  click: []
}>()

function onActivate() {
  emit('click')
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    emit('click')
  }
}
</script>

<template>
  <button
    type="button"
    class="group relative aspect-square w-full overflow-hidden rounded-lg border border-border-subtle bg-bg-elevated shadow-sm ring-offset-2 transition hover:border-blue-400 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:shadow-none dark:hover:border-blue-500"
    data-testid="photo-thumbnail"
    :aria-label="`Open photo: ${alt}`"
    @click="onActivate"
    @keydown="onKeydown"
  >
    <img :src="src" :alt="alt" loading="lazy" decoding="async" class="h-full w-full object-cover" />
    <span
      class="pointer-events-none absolute inset-0 bg-black/0 transition group-hover:bg-black/10 group-focus-visible:bg-black/10"
      aria-hidden="true"
    />
  </button>
</template>
