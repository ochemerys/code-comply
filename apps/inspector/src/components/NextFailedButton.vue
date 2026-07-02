<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  failedCount: number
  nextFailedId: () => string | null
  scrollContainer?: HTMLElement | null
  offsetPx?: number
  highlightDurationMs?: number
}

const props = withDefaults(defineProps<Props>(), {
  scrollContainer: null,
  offsetPx: 100,
  highlightDurationMs: 2000,
})

const isDisabled = computed(() => props.failedCount <= 0)

function highlight(el: HTMLElement) {
  const cls = ['ring-2', 'ring-primary', 'ring-offset-2', 'ring-offset-bg-app']
  el.classList.add(...cls)
  window.setTimeout(() => el.classList.remove(...cls), props.highlightDurationMs)
}

function scrollToTarget(el: HTMLElement) {
  const container = props.scrollContainer
  if (!container) {
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    highlight(el)
    return
  }

  const containerRect = container.getBoundingClientRect()
  const elRect = el.getBoundingClientRect()
  const yInContainer = container.scrollTop + (elRect.top - containerRect.top)
  const top = Math.max(0, yInContainer - props.offsetPx)

  container.scrollTo({ top, behavior: 'smooth' })
  highlight(el)
}

function onClick() {
  if (isDisabled.value) return
  const id = props.nextFailedId()
  if (!id) return
  const el = document.getElementById(`checklist-item-${id}`)
  if (!el) return
  scrollToTarget(el)
}
</script>

<template>
  <button
    type="button"
    class="min-h-touch px-4 rounded-xl border border-border-subtle bg-bg-surface text-text-primary text-base font-medium hover:bg-gray-50 dark:hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary active:scale-95 transition-all duration-200 ease-out disabled:opacity-50 disabled:cursor-not-allowed"
    data-testid="checklist-next-failed"
    :disabled="isDisabled"
    :aria-disabled="isDisabled"
    @click="onClick"
  >
    Next failed
  </button>
</template>
