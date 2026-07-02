<script setup lang="ts">
/**
 * M7-S12: Touch-friendly annotation tool strip (arrow, circle, text, undo, save).
 */
import type { AnnotationTool } from '@/composables/usePhotoAnnotation'

defineProps<{
  activeTool: AnnotationTool | null
  canUndo: boolean
  saving?: boolean
}>()

const emit = defineEmits<{
  'select-tool': [tool: AnnotationTool]
  undo: []
  save: []
}>()
</script>

<template>
  <div
    class="flex shrink-0 flex-col gap-2 border-t border-white/10 bg-slate-900 px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
    data-testid="annotation-toolbar"
    role="toolbar"
    aria-label="Photo annotation tools"
  >
    <div class="flex flex-wrap items-center justify-center gap-2">
      <button
        type="button"
        class="flex min-h-touch min-w-touch flex-1 basis-[30%] items-center justify-center gap-2 rounded-lg border py-2 text-sm font-medium sm:flex-none sm:basis-auto"
        :class="
          activeTool === 'arrow'
            ? 'border-blue-400 bg-blue-600/30 text-white'
            : 'border-white/20 bg-white/10 text-white'
        "
        :aria-pressed="activeTool === 'arrow'"
        data-testid="annotation-tool-arrow"
        @click="emit('select-tool', 'arrow')"
      >
        <svg class="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M14 5l7 7m0 0l-7 7m7-7H3"
          />
        </svg>
        <span>Arrow</span>
      </button>
      <button
        type="button"
        class="flex min-h-touch min-w-touch flex-1 basis-[30%] items-center justify-center gap-2 rounded-lg border py-2 text-sm font-medium sm:flex-none sm:basis-auto"
        :class="
          activeTool === 'circle'
            ? 'border-blue-400 bg-blue-600/30 text-white'
            : 'border-white/20 bg-white/10 text-white'
        "
        :aria-pressed="activeTool === 'circle'"
        data-testid="annotation-tool-circle"
        @click="emit('select-tool', 'circle')"
      >
        <svg class="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="9" stroke-width="2" />
        </svg>
        <span>Circle</span>
      </button>
      <button
        type="button"
        class="flex min-h-touch min-w-touch flex-1 basis-[30%] items-center justify-center gap-2 rounded-lg border py-2 text-sm font-medium sm:flex-none sm:basis-auto"
        :class="
          activeTool === 'text'
            ? 'border-blue-400 bg-blue-600/30 text-white'
            : 'border-white/20 bg-white/10 text-white'
        "
        :aria-pressed="activeTool === 'text'"
        data-testid="annotation-tool-text"
        @click="emit('select-tool', 'text')"
      >
        <svg class="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M4 6h16M4 12h10M4 18h16"
          />
        </svg>
        <span>Text</span>
      </button>
    </div>
    <div class="flex gap-2">
      <button
        type="button"
        class="min-h-touch flex-1 rounded-lg border border-white/20 bg-white/10 py-3 text-base font-medium text-white disabled:opacity-40"
        :disabled="!canUndo"
        data-testid="annotation-undo"
        @click="emit('undo')"
      >
        <span class="inline-flex items-center justify-center gap-2">
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M3 10h10a5 5 0 015 5v2M3 10l4-4m-4 4l4 4"
            />
          </svg>
          Undo
        </span>
      </button>
      <button
        type="button"
        class="min-h-touch flex-1 rounded-lg bg-blue-600 py-3 text-base font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        :disabled="saving"
        data-testid="annotation-save"
        @click="emit('save')"
      >
        {{ saving ? 'Saving…' : 'Save' }}
      </button>
    </div>
  </div>
</template>
