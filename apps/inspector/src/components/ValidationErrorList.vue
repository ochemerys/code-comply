<script setup lang="ts">
import { computed, nextTick } from 'vue'

export type ValidationErrorSeverity = 'error' | 'warning'

export type ValidationErrorListItem = {
  message: string
  hint?: string
  severity?: ValidationErrorSeverity
  /** Optional DOM id to link to (e.g. "inspection-review-outcome"). */
  targetId?: string
  /** When set, link navigates to this checklist row instead of scrolling to targetId. */
  checklistItemId?: string
  /** Optional label for the action link. Defaults to "Go to section". */
  actionLabel?: string
}

const props = defineProps<{
  errors: ValidationErrorListItem[]
  title?: string
}>()

const emit = defineEmits<{
  'checklist-item': [itemId: string]
}>()

const titleText = computed(() => props.title?.trim() || 'Fix these before submitting')
const count = computed(() => props.errors.length)

async function onErrorLinkClick(e: ValidationErrorListItem, event: Event) {
  if (e.checklistItemId) {
    event.preventDefault()
    emit('checklist-item', e.checklistItemId)
    return
  }
  if (e.targetId) {
    event.preventDefault()
    await focusTarget(e.targetId)
  }
}

async function focusTarget(id: string) {
  await nextTick()
  const el = document.getElementById(id)
  if (!el) return

  try {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  } catch {
    el.scrollIntoView()
  }

  const focusable = el as HTMLElement
  if (typeof focusable.focus === 'function') {
    const tabIndex = focusable.getAttribute('tabindex')
    if (
      tabIndex != null ||
      ['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes(focusable.tagName)
    ) {
      focusable.focus()
    }
  }
}
</script>

<template>
  <section
    v-if="count > 0"
    class="rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100"
    data-testid="validation-error-list"
    role="alert"
    aria-live="polite"
  >
    <div class="flex items-start justify-between gap-3">
      <h3 class="text-base font-semibold" data-testid="validation-error-list-title">
        {{ titleText }}
      </h3>
      <span
        class="inline-flex items-center rounded-full border border-red-200/60 bg-white/60 px-3 py-1 text-xs font-semibold dark:border-red-900/70 dark:bg-red-950/50"
        data-testid="validation-error-list-count"
        aria-label="Validation error count"
      >
        {{ count }}
      </span>
    </div>

    <ul class="mt-3 space-y-2" data-testid="validation-error-list-items">
      <li
        v-for="(e, idx) in errors"
        :key="idx"
        class="rounded-xl border border-red-200/80 bg-white/60 px-4 py-3 text-sm dark:border-red-900/70 dark:bg-red-950/50"
        :data-testid="`validation-error-item-${idx}`"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="font-medium">
              <span class="sr-only">{{ e.severity ?? 'error' }}:</span>
              {{ e.message }}
            </p>
            <p v-if="e.hint" class="mt-1 text-red-800/90 dark:text-red-200/90">
              {{ e.hint }}
            </p>
          </div>

          <a
            v-if="e.targetId || e.checklistItemId"
            class="shrink-0 rounded-lg border border-red-200/70 bg-white/70 px-3 py-1 text-xs font-semibold text-red-900 hover:bg-white focus:outline-none focus:ring-2 focus:ring-primary dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-100"
            :href="e.targetId ? `#${e.targetId}` : '#'"
            :data-testid="`validation-error-link-${idx}`"
            @click="onErrorLinkClick(e, $event)"
          >
            {{ e.actionLabel?.trim() || 'Go to section' }}
          </a>
        </div>
      </li>
    </ul>
  </section>
</template>
