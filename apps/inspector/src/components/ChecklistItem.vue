<template>
  <div
    :class="[
      'checklist-item',
      'bg-surface border border-subtle rounded-lg p-4',
      'transition-all duration-200',
      {
        'border-green-500 bg-green-50 dark:bg-green-900/10': result === 'PASS',
        'border-red-500 bg-red-50 dark:bg-red-900/10': result === 'FAIL',
        'border-gray-400 bg-gray-50 dark:bg-gray-800/50': result === 'NA',
      },
    ]"
  >
    <!-- Item Description + linked deficiency badge (failed items only) -->
    <div class="mb-4 flex items-start justify-between gap-3">
      <div class="min-w-0 flex-1">
        <h3 class="text-base font-medium text-primary leading-snug">
          {{ item.description }}
        </h3>
        <p v-if="item.codeReference" class="text-sm text-secondary mt-1">
          {{ item.codeReference }}
        </p>
      </div>
      <DeficiencyIndicator
        v-if="result === 'FAIL' && linkedDeficiencyCount > 0"
        :count="linkedDeficiencyCount"
        class="shrink-0 self-start"
        @activate="$emit('navigate-linked-deficiencies', { itemId: item.id })"
      />
    </div>

    <!-- Pass/Fail/N/A Buttons -->
    <div class="flex gap-2 mb-4">
      <button
        type="button"
        :class="[
          'flex-1 h-11 min-h-[44px]',
          'rounded-lg font-medium text-base',
          'transition-all duration-200 ease-out',
          'active:scale-95',
          'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500',
          result === 'PASS'
            ? 'bg-green-600 text-white shadow-sm dark:shadow-none dark:border dark:border-green-700'
            : 'bg-surface border border-subtle text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700',
        ]"
        @click="handleResultChange('PASS')"
      >
        <span class="flex items-center justify-center gap-2">
          <svg
            v-if="result === 'PASS'"
            class="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M5 13l4 4L19 7"
            />
          </svg>
          Pass
        </span>
      </button>

      <button
        type="button"
        :class="[
          'flex-1 h-11 min-h-[44px]',
          'rounded-lg font-medium text-base',
          'transition-all duration-200 ease-out',
          'active:scale-95',
          'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500',
          result === 'FAIL'
            ? 'bg-red-600 text-white shadow-sm dark:shadow-none dark:border dark:border-red-800'
            : 'bg-surface border border-subtle text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700',
        ]"
        @click="handleResultChange('FAIL')"
      >
        <span class="flex items-center justify-center gap-2">
          <svg
            v-if="result === 'FAIL'"
            class="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
          Fail
        </span>
      </button>

      <button
        type="button"
        :class="[
          'flex-1 h-11 min-h-[44px]',
          'rounded-lg font-medium text-base',
          'transition-all duration-200 ease-out',
          'active:scale-95',
          'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500',
          result === 'NA'
            ? 'bg-gray-600 text-white shadow-sm dark:shadow-none dark:border dark:border-gray-700'
            : 'bg-surface border border-subtle text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700',
        ]"
        @click="handleResultChange('NA')"
      >
        <span class="flex items-center justify-center gap-2">
          <svg
            v-if="result === 'NA'"
            class="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4" />
          </svg>
          N/A
        </span>
      </button>
    </div>

    <!-- Code Reference Display (shown when FAIL is selected) -->
    <div
      v-if="result === 'FAIL' && selectedCodeReference"
      class="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
    >
      <div class="flex items-start justify-between">
        <div class="flex-1">
          <p class="text-sm font-medium text-red-900 dark:text-red-100">Code Reference Required</p>
          <p class="text-sm text-red-700 dark:text-red-300 mt-1">
            {{ selectedCodeReference.code }} - {{ selectedCodeReference.section }}
          </p>
        </div>
        <button
          type="button"
          class="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200"
          @click="$emit('change-code-reference')"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
            />
          </svg>
        </button>
      </div>
    </div>

    <!-- Prompt for Code Reference (shown when FAIL is selected but no code reference) -->
    <div
      v-if="result === 'FAIL' && !selectedCodeReference"
      class="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
    >
      <p class="text-sm font-medium text-red-900 dark:text-red-100 mb-2">Code Reference Required</p>
      <button
        type="button"
        class="w-full h-11 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 active:scale-95 transition-all duration-200"
        @click="$emit('select-code-reference')"
      >
        Select Code Reference
      </button>
    </div>

    <!-- M7-S16: evidence gallery when template requires photos or item is failed -->
    <div
      v-if="inspectionId && showPhotoGallerySurface"
      class="mt-4 border-t border-border-subtle pt-4"
      data-testid="checklist-item-photo-gallery-wrap"
    >
      <p
        v-if="missingMandatoryPhoto"
        class="mb-2 text-sm font-medium text-amber-800 dark:text-amber-200"
        data-testid="checklist-item-mandatory-photo-warning"
      >
        Add at least one photo for this failed item before completing the inspection.
      </p>
      <PhotoGallery
        :inspection-id="inspectionId"
        :checklist-item-id="item.id"
        :capture-return-route="captureReturnRoute"
        :capture-return-route-query="captureReturnRouteQuery"
      />
    </div>

    <!-- Visual Feedback Indicator -->
    <div
      v-if="showFeedback"
      class="absolute inset-0 bg-blue-500/10 rounded-lg pointer-events-none animate-pulse"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import DeficiencyIndicator from '@/components/DeficiencyIndicator.vue'
import PhotoGallery from '@/components/PhotoGallery.vue'

export interface ChecklistItemData {
  id: string
  description: string
  codeReference?: string
  /** When true with FAIL, at least one checklist-scoped photo is required (M7-S16). */
  requiresPhoto?: boolean
  result?: 'PASS' | 'FAIL' | 'NA'
  selectedCodeReference?: {
    code: string
    section: string
  }
}

interface Props {
  item: ChecklistItemData
  /** Deficiencies in local/API cache linked to this checklist item id */
  linkedDeficiencyCount?: number
  /** When set with requiresPhoto/FAIL, embeds PhotoGallery for this checklist line (M7-S16). */
  inspectionId?: string
  /** Route name for capture return; defaults to parent responsibility. */
  captureReturnRoute?: string
  /** Query params for capture-photo so return navigation can include route params (M7-S11-B1). */
  captureReturnRouteQuery?: Record<string, string>
  /** Parent-driven: FAIL + requiresPhoto but no stored photos yet */
  missingMandatoryPhoto?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  linkedDeficiencyCount: 0,
  missingMandatoryPhoto: false,
})

const emit = defineEmits<{
  'update:result': [result: 'PASS' | 'FAIL' | 'NA']
  'select-code-reference': []
  'change-code-reference': []
  /**
   * After FAIL and a code reference is set (parent flow — M6-S13).
   * Parent listeners must handle errors; this component still catches sync throws and async
   * rejections so watcher / handler paths do not surface unhandled promise rejections.
   */
  'open-deficiency-form': [
    payload: { itemId: string; codeReference: { code: string; section: string } },
  ]
  /** M6-S14: open deficiency list scoped to this checklist item */
  'navigate-linked-deficiencies': [payload: { itemId: string }]
}>()

type OpenDeficiencyFormPayload = {
  itemId: string
  codeReference: { code: string; section: string }
}

/**
 * Emits `open-deficiency-form`. Synchronous throws from the parent listener are caught here.
 * Async listeners must not return a bare rejected promise — use e.g.
 * `@open-deficiency-form="(p) => void onOpen(p).catch(log)"` because Vue does not surface
 * listener promises back through `emit()`, so the child cannot attach a rejection handler.
 */
function emitOpenDeficiencyFormSafely(payload: OpenDeficiencyFormPayload) {
  try {
    emit('open-deficiency-form', payload)
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err))
    console.error('[ChecklistItem] open-deficiency-form listener threw:', e)
  }
}

const result = ref<'PASS' | 'FAIL' | 'NA' | undefined>(props.item.result)
const selectedCodeReference = ref(props.item.selectedCodeReference)
const showFeedback = ref(false)

const showPhotoGallerySurface = computed(() => {
  const needs = props.item.requiresPhoto === true
  return Boolean(needs || result.value === 'FAIL')
})

// Watch for external changes to item
watch(
  () => props.item.result,
  (newResult) => {
    result.value = newResult
  },
)

watch(
  () => props.item.selectedCodeReference,
  (newRef, oldRef) => {
    selectedCodeReference.value = newRef
    if (
      result.value === 'FAIL' &&
      newRef != null &&
      oldRef == null &&
      newRef.code?.trim() &&
      newRef.section?.trim()
    ) {
      emitOpenDeficiencyFormSafely({
        itemId: props.item.id,
        codeReference: { code: newRef.code, section: newRef.section },
      })
    }
  },
)

const handleResultChange = (newResult: 'PASS' | 'FAIL' | 'NA') => {
  // Visual feedback
  showFeedback.value = true
  setTimeout(() => {
    showFeedback.value = false
  }, 300)

  // Haptic feedback if available
  if ('vibrate' in navigator) {
    navigator.vibrate(10)
  }

  result.value = newResult
  emit('update:result', newResult)

  if (newResult === 'FAIL' && selectedCodeReference.value) {
    const c = selectedCodeReference.value
    if (c.code?.trim() && c.section?.trim()) {
      emitOpenDeficiencyFormSafely({
        itemId: props.item.id,
        codeReference: { code: c.code, section: c.section },
      })
    }
  } else if (newResult === 'FAIL' && !selectedCodeReference.value) {
    setTimeout(() => {
      emit('select-code-reference')
    }, 300)
  }
}
</script>

<style scoped>
.checklist-item {
  position: relative;
  -webkit-tap-highlight-color: transparent;
}

/* Ensure touch targets are accessible */
button {
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}

/* Smooth transitions for state changes */
.checklist-item {
  transition-property: background-color, border-color, box-shadow;
  transition-timing-function: ease-out;
  transition-duration: 200ms;
}
</style>
