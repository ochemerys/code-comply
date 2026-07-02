<script setup lang="ts">
defineProps<{
  mode: 'loading' | 'retry'
  errorMessage?: string
}>()

const emit = defineEmits<{
  retry: []
}>()
</script>

<template>
  <div
    class="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg-app px-4 text-center"
    role="status"
    aria-live="polite"
  >
    <template v-if="mode === 'loading'">
      <div
        class="h-10 w-10 animate-spin rounded-full border-4 border-border-subtle border-t-blue-600"
        aria-hidden="true"
      />
      <p class="text-sm text-text-secondary">Restoring your session…</p>
    </template>
    <template v-else>
      <p class="max-w-md text-sm text-text-secondary">
        {{
          errorMessage ?? 'We could not verify your session. Check your connection and try again.'
        }}
      </p>
      <button
        type="button"
        class="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        @click="emit('retry')"
      >
        Retry
      </button>
    </template>
  </div>
</template>
