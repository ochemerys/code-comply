<script setup lang="ts">
import { computed, ref, watch, useId } from 'vue'
import { useVoiceToText } from '@/composables/useVoiceToText'
import { voiceInputErrorHelp } from '@/components/voice-input-error-help'

const props = withDefaults(
  defineProps<{
    disabled?: boolean
    lang?: string
  }>(),
  {},
)

const emit = defineEmits<{
  (e: 'transcript', text: string): void
}>()

const voice = useVoiceToText({ lang: props.lang })

const isHolding = ref(false)
const finalizePending = ref(false)

const showError = computed(() => voice.error.value !== null)
const showProcessing = computed(() => finalizePending.value)
const showRecording = computed(
  () => isHolding.value && voice.isListening.value && !voice.error.value,
)

const errorPanelId = useId()
const unsupportedHintId = useId()
const errorHelp = computed(() => voiceInputErrorHelp(voice.error.value?.message ?? null))

const buttonAriaDescribedBy = computed(() => {
  if (showError.value) return errorPanelId
  if (!voice.isSupported.value) return unsupportedHintId
  return undefined
})

function emitTranscriptIfPending(): void {
  if (!finalizePending.value) return
  finalizePending.value = false
  const text = voice.transcript.value.trim()
  voice.clear()
  if (text) emit('transcript', text)
}

watch(
  () => voice.isListening.value,
  (listening) => {
    if (!listening) emitTranscriptIfPending()
  },
)

function detachWindowReleaseListeners(): void {
  window.removeEventListener('mouseup', onWindowRelease)
  window.removeEventListener('pointerup', onWindowRelease)
}

function onWindowRelease(): void {
  detachWindowReleaseListeners()
  finalizeVoiceHold()
}

function attachWindowReleaseListeners(): void {
  detachWindowReleaseListeners()
  window.addEventListener('mouseup', onWindowRelease, { once: true })
  window.addEventListener('pointerup', onWindowRelease, { once: true })
}

function onPointerDown(e: PointerEvent): void {
  if (props.disabled) return
  const el = e.currentTarget
  if (!(el instanceof HTMLButtonElement)) return

  voice.startListening()
  if (voice.error.value || !voice.isListening.value) return

  isHolding.value = true
  attachWindowReleaseListeners()
  try {
    el.setPointerCapture(e.pointerId)
  } catch {
    /* ignore if capture unsupported */
  }
}

function onPointerEnd(e: PointerEvent): void {
  const el = e.currentTarget
  if (!(el instanceof HTMLButtonElement)) return

  try {
    if (el.hasPointerCapture(e.pointerId)) {
      el.releasePointerCapture(e.pointerId)
    }
  } catch {
    /* ignore */
  }

  detachWindowReleaseListeners()
  finalizeVoiceHold()
}

/** Mouse fallback when pointer events are unavailable (legacy / automation edge cases). */
function onMouseDown(e: MouseEvent): void {
  if (e.button !== 0 || props.disabled || isHolding.value) return
  const el = e.currentTarget
  if (!(el instanceof HTMLButtonElement)) return

  voice.startListening()
  if (voice.error.value || !voice.isListening.value) return

  isHolding.value = true
  attachWindowReleaseListeners()
}

/** Mouse fallback release (automation / browsers without reliable pointerup on the button). */
function onMouseUp(e: MouseEvent): void {
  if (e.button !== 0 || !isHolding.value) return
  detachWindowReleaseListeners()
  finalizeVoiceHold()
}

function finalizeVoiceHold(): void {
  const wasHolding = isHolding.value
  isHolding.value = false

  if (!wasHolding || !voice.isListening.value) return

  finalizePending.value = true
  voice.stopListening()
  // E2E mock and some browsers finish synchronously inside stop(); watch covers async onend.
  if (!voice.isListening.value) emitTranscriptIfPending()
}
</script>

<template>
  <div class="inline-flex shrink-0 flex-col items-end gap-1.5">
    <button
      type="button"
      data-testid="voice-input-button"
      class="inline-flex h-11 min-h-touch w-11 min-w-touch shrink-0 items-center justify-center rounded-lg border border-subtle bg-surface text-gray-900 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:border-slate-700 dark:bg-slate-800 dark:text-gray-100 dark:hover:bg-slate-700 dark:focus:ring-blue-400 dark:focus:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
      :disabled="disabled || !voice.isSupported.value"
      :aria-label="
        voice.isSupported.value
          ? showError
            ? 'Voice input error. See message below. Press to try again.'
            : 'Voice input. Press and hold to dictate.'
          : 'Voice input is not supported in this browser'
      "
      :aria-describedby="buttonAriaDescribedBy"
      :aria-invalid="showError"
      :aria-busy="showProcessing"
      :aria-pressed="showRecording"
      @pointerdown="onPointerDown"
      @pointerup="onPointerEnd"
      @pointercancel="onPointerEnd"
      @lostpointercapture="onPointerEnd"
      @mousedown="onMouseDown"
      @mouseup="onMouseUp"
    >
      <span v-if="showError" class="text-red-600 dark:text-red-400" data-testid="voice-input-error">
        <svg
          class="h-6 w-6"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
          />
        </svg>
      </span>

      <span
        v-else-if="showProcessing"
        class="text-blue-600 dark:text-blue-400"
        data-testid="voice-input-processing"
      >
        <svg class="h-6 w-6 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
          <circle
            class="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            stroke-width="4"
          />
          <path
            class="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      </span>

      <span
        v-else-if="showRecording"
        class="text-blue-600 dark:text-blue-400"
        data-testid="voice-input-recording"
      >
        <span class="relative flex h-8 w-8 items-center justify-center">
          <span
            class="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-40"
            aria-hidden="true"
          />
          <svg
            class="relative h-6 w-6"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
            />
          </svg>
        </span>
      </span>

      <span v-else class="text-gray-700 dark:text-gray-200" data-testid="voice-input-idle">
        <svg
          class="h-6 w-6"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
          />
        </svg>
      </span>
    </button>

    <p
      v-if="!voice.isSupported.value"
      :id="unsupportedHintId"
      class="max-w-[min(100vw-2rem,18rem)] text-right text-xs leading-snug text-gray-600 dark:text-gray-400"
      data-testid="voice-input-unsupported-hint"
    >
      Voice typing is not available in this browser. Use Chrome, Edge, or Safari—or type your note
      instead.
    </p>

    <div
      v-else-if="showError"
      :id="errorPanelId"
      class="max-w-[min(100vw-2rem,20rem)] rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-right shadow-sm dark:border-red-900/60 dark:bg-red-950/40"
      role="alert"
      aria-live="polite"
      data-testid="voice-input-error-panel"
    >
      <p
        class="text-sm font-medium text-red-900 dark:text-red-100"
        data-testid="voice-input-error-summary"
      >
        {{ errorHelp.summary }}
      </p>
      <p
        class="mt-1 text-xs leading-snug text-red-800 dark:text-red-200/90"
        data-testid="voice-input-error-resolution"
      >
        {{ errorHelp.resolution }}
      </p>
    </div>
  </div>
</template>
