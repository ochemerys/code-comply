import { computed, ref, shallowRef, type ComputedRef, type Ref } from 'vue'

/** Result entry from {@link https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognitionResult | SpeechRecognitionResult} */
type RecognitionResult = { readonly isFinal: boolean; 0: { transcript: string } }

/** Minimal shape used by this composable (works with Chromium + Safari `webkit` prefix). */
type RecognitionResultList = { readonly length: number; [index: number]: RecognitionResult }

type RecognitionResultEvent = {
  readonly resultIndex: number
  readonly results: RecognitionResultList
}

export interface SpeechRecognitionInstance {
  continuous: boolean
  interimResults: boolean
  lang: string
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((ev: RecognitionResultEvent) => void) | null
  onerror: ((ev: { error: string }) => void) | null
  onend: (() => void) | null
}

export type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance

export const DEFAULT_SPEECH_LANG = 'en-US'

export interface UseVoiceToTextOptions {
  lang?: string
  continuous?: boolean
  interimResults?: boolean
}

export interface UseVoiceToText {
  isListening: Ref<boolean>
  transcript: Ref<string>
  error: Ref<Error | null>
  isSupported: ComputedRef<boolean>
  startListening: () => void
  stopListening: () => void
  clear: () => void
}

function getSpeechRecognitionCtor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

function buildTranscriptFromResults(results: RecognitionResultList): string {
  let text = ''
  for (let i = 0; i < results.length; i++) {
    text += results[i][0].transcript
  }
  return text
}

/**
 * Voice-to-text via the Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`).
 * Suitable for field notes on inspector mobile (including Safari iOS with the webkit prefix).
 * When offline or unsupported, `startListening` sets `error` and does not throw.
 */
export function useVoiceToText(options?: UseVoiceToTextOptions): UseVoiceToText {
  const isListening = ref(false)
  const transcript = ref('')
  const error = ref<Error | null>(null)
  const recognition = shallowRef<SpeechRecognitionInstance | null>(null)

  const lang = options?.lang ?? DEFAULT_SPEECH_LANG
  const continuous = options?.continuous ?? true
  const interimResults = options?.interimResults ?? true

  const isSupported = computed(() => getSpeechRecognitionCtor() !== null)

  function startListening(): void {
    error.value = null

    const Ctor = getSpeechRecognitionCtor()
    if (!Ctor) {
      error.value = new Error('Speech recognition is not supported in this browser')
      return
    }

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      error.value = new Error('Voice recognition is unavailable while offline')
      return
    }

    try {
      const prev = recognition.value
      if (prev) {
        try {
          prev.abort()
        } catch {
          /* ignore */
        }
        recognition.value = null
      }

      const rec = new Ctor()
      rec.continuous = continuous
      rec.interimResults = interimResults
      rec.lang = lang

      rec.onresult = (event) => {
        transcript.value = buildTranscriptFromResults(event.results)
      }

      rec.onerror = (ev) => {
        error.value = new Error(`Speech recognition error: ${ev.error}`)
        isListening.value = false
      }

      rec.onend = () => {
        isListening.value = false
      }

      recognition.value = rec
      rec.start()
      isListening.value = true
    } catch (e) {
      error.value = e instanceof Error ? e : new Error(String(e))
      isListening.value = false
    }
  }

  function stopListening(): void {
    const rec = recognition.value
    if (!rec) {
      isListening.value = false
      return
    }
    try {
      rec.stop()
    } catch {
      isListening.value = false
    }
  }

  function clear(): void {
    transcript.value = ''
    error.value = null
  }

  return {
    isListening,
    transcript,
    error,
    isSupported,
    startListening,
    stopListening,
    clear,
  }
}
