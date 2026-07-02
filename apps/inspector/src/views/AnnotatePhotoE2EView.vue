<script setup lang="ts">
/**
 * Dev-only screen: exposes PhotoAnnotator in a real browser for M7-S18 E2E.
 * Registered when not in production, or when `VITE_ENABLE_E2E_ROUTES=true` (Docker E2E).
 */
import { ref } from 'vue'
import { defineLazyComponent } from '@/lib/lazy-component'

const PhotoAnnotator = defineLazyComponent(() => import('@/components/PhotoAnnotator.vue'))

/** 1×1 PNG — enough for Fabric mount + arrow draw in Playwright. */
const PLACEHOLDER_IMAGE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

const savedBytes = ref<number | null>(null)

function onSave(blob: Blob) {
  savedBytes.value = blob.size
}
</script>

<template>
  <div class="relative min-h-dvh bg-black text-white" data-testid="e2e-annotate-photo-root">
    <p
      v-if="savedBytes != null"
      class="absolute left-0 right-0 top-0 z-[100] bg-emerald-700 px-3 py-2 text-center text-sm font-medium"
      data-testid="e2e-annotate-photo-saved"
    >
      Saved annotation ({{ savedBytes }} bytes)
    </p>
    <PhotoAnnotator :image-src="PLACEHOLDER_IMAGE" @save="onSave" />
  </div>
</template>
