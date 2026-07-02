<script lang="ts">
let scrollLockCount = 0
let previousBodyOverflow = ''
</script>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'

defineOptions({ inheritAttrs: false })

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    labelledBy?: string
    describedBy?: string
    role?: 'dialog' | 'alertdialog'
    dismissible?: boolean
    closeOnBackdrop?: boolean
    closeOnEscape?: boolean
    maxWidthClass?: string
    panelClass?: string
    overlayTestId?: string
  }>(),
  {
    role: 'dialog',
    dismissible: true,
    closeOnBackdrop: true,
    closeOnEscape: true,
    maxWidthClass: 'max-w-lg',
    panelClass: '',
    overlayTestId: undefined,
    labelledBy: undefined,
    describedBy: undefined,
  },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'close'): void
}>()

const panelRef = ref<HTMLElement | null>(null)
const previouslyFocused = ref<HTMLElement | null>(null)
const dragY = ref(0)
const isDragging = ref(false)

let dragStartY = 0
let hasScrollLock = false

const panelClasses = computed(() => [
  'relative flex max-h-[90dvh] w-full flex-col overflow-hidden',
  'rounded-t-2xl border border-border-subtle bg-bg-elevated shadow-lg dark:shadow-none',
  'pb-[env(safe-area-inset-bottom)] tablet:rounded-2xl tablet:pb-0',
  props.maxWidthClass,
  props.panelClass,
])

const panelStyle = computed(() => ({
  transform: dragY.value > 0 ? `translateY(${dragY.value}px)` : undefined,
  transition: isDragging.value ? 'none' : 'transform 160ms ease-out',
}))

function lockScroll() {
  if (typeof document === 'undefined') return
  if (scrollLockCount === 0) {
    previousBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }
  scrollLockCount += 1
}

function unlockScroll() {
  if (typeof document === 'undefined' || scrollLockCount === 0) return
  scrollLockCount -= 1
  if (scrollLockCount === 0) {
    document.body.style.overflow = previousBodyOverflow
    previousBodyOverflow = ''
  }
}

function releaseOwnScrollLock() {
  if (!hasScrollLock) return
  unlockScroll()
  hasScrollLock = false
}

function requestClose() {
  if (!props.dismissible) return
  emit('update:modelValue', false)
  emit('close')
}

function onBackdropClick() {
  if (!props.closeOnBackdrop) return
  requestClose()
}

function focusableElements(): HTMLElement[] {
  const panel = panelRef.value
  if (!panel) return []
  return Array.from(panel.querySelectorAll<HTMLElement>(focusableSelector)).filter(
    (el) => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true',
  )
}

function focusFirstElement() {
  const [first] = focusableElements()
  ;(first ?? panelRef.value)?.focus({ preventScroll: true })
}

function onDocumentKeydown(e: KeyboardEvent) {
  if (!props.modelValue) return

  if (e.key === 'Escape' && props.closeOnEscape) {
    e.preventDefault()
    requestClose()
    return
  }

  if (e.key !== 'Tab') return

  const focusable = focusableElements()
  if (focusable.length === 0) {
    e.preventDefault()
    panelRef.value?.focus({ preventScroll: true })
    return
  }

  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault()
    first.focus()
  }
}

function stopDragListeners() {
  if (typeof window === 'undefined') return
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('pointercancel', onPointerUp)
}

function onPointerDown(e: PointerEvent) {
  if (!props.dismissible) return
  dragStartY = e.clientY
  isDragging.value = true
  dragY.value = 0
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointercancel', onPointerUp)
}

function onPointerMove(e: PointerEvent) {
  if (!isDragging.value) return
  dragY.value = Math.max(0, e.clientY - dragStartY)
  if (dragY.value > 0) e.preventDefault()
}

function onPointerUp() {
  if (!isDragging.value) return
  isDragging.value = false
  stopDragListeners()

  const height = panelRef.value?.offsetHeight ?? 0
  if (height > 0 && dragY.value >= height * 0.5) {
    dragY.value = 0
    requestClose()
    return
  }
  dragY.value = 0
}

watch(
  () => props.modelValue,
  async (open) => {
    if (typeof document === 'undefined') return

    if (!open) {
      document.removeEventListener('keydown', onDocumentKeydown)
      releaseOwnScrollLock()
      stopDragListeners()
      isDragging.value = false
      dragY.value = 0
      previouslyFocused.value?.focus?.({ preventScroll: true })
      previouslyFocused.value = null
      return
    }

    previouslyFocused.value = document.activeElement as HTMLElement | null
    if (!hasScrollLock) {
      lockScroll()
      hasScrollLock = true
    }
    document.addEventListener('keydown', onDocumentKeydown)
    await nextTick()
    focusFirstElement()
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  if (typeof document !== 'undefined') {
    document.removeEventListener('keydown', onDocumentKeydown)
  }
  releaseOwnScrollLock()
  stopDragListeners()
})
</script>

<template>
  <teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-0 z-modal flex items-end justify-center bg-black/40 pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] tablet:items-center tablet:p-4"
      :data-testid="overlayTestId"
      @click.self="onBackdropClick"
    >
      <div
        v-bind="$attrs"
        ref="panelRef"
        :class="panelClasses"
        :style="panelStyle"
        :role="role"
        aria-modal="true"
        :aria-labelledby="labelledBy"
        :aria-describedby="describedBy"
        tabindex="-1"
        @click.stop
      >
        <div
          class="mx-auto mt-2 h-1.5 w-10 shrink-0 cursor-grab rounded-full bg-gray-300 active:cursor-grabbing tablet:hidden"
          data-testid="bottom-sheet-drag-handle"
          aria-hidden="true"
          @pointerdown="onPointerDown"
        />
        <slot />
      </div>
    </div>
  </teleport>
</template>
