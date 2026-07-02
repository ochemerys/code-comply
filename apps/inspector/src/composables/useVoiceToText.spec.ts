import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { useVoiceToText, DEFAULT_SPEECH_LANG } from './useVoiceToText'

type MockRecognition = {
  continuous: boolean
  interimResults: boolean
  lang: string
  start: ReturnType<typeof vi.fn>
  stop: ReturnType<typeof vi.fn>
  abort: ReturnType<typeof vi.fn>
  onresult: ((ev: unknown) => void) | null
  onerror: ((ev: { error: string }) => void) | null
  onend: (() => void) | null
}

describe('useVoiceToText', () => {
  let MockRec: { new (): MockRecognition }
  let lastInstance: MockRecognition | null

  beforeEach(() => {
    lastInstance = null
    MockRec = vi.fn().mockImplementation(function (this: Record<string, unknown>) {
      const inst = {
        continuous: false,
        interimResults: false,
        lang: '',
        start: vi.fn(),
        stop: vi.fn(),
        abort: vi.fn(),
        onresult: null as ((ev: unknown) => void) | null,
        onerror: null as ((ev: { error: string }) => void) | null,
        onend: null as (() => void) | null,
      }
      lastInstance = inst
      return inst
    }) as unknown as typeof MockRec

    Object.defineProperty(window, 'SpeechRecognition', {
      configurable: true,
      writable: true,
      value: MockRec,
    })
    delete (window as Window & { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      writable: true,
      value: true,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete (window as Window & { SpeechRecognition?: unknown }).SpeechRecognition
    delete (window as Window & { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition
  })

  it('isSupported is true when SpeechRecognition exists', () => {
    const v = useVoiceToText()
    expect(v.isSupported.value).toBe(true)
  })

  it('isSupported is false without API (including no webkit fallback)', () => {
    delete (window as Window & { SpeechRecognition?: unknown }).SpeechRecognition
    const v = useVoiceToText()
    expect(v.isSupported.value).toBe(false)
  })

  it('uses webkitSpeechRecognition when standard name is missing', () => {
    delete (window as Window & { SpeechRecognition?: unknown }).SpeechRecognition
    Object.defineProperty(window, 'webkitSpeechRecognition', {
      configurable: true,
      writable: true,
      value: MockRec,
    })
    const v = useVoiceToText()
    expect(v.isSupported.value).toBe(true)
  })

  it('startListening configures recognition and calls start', () => {
    const v = useVoiceToText()
    v.startListening()
    expect(MockRec).toHaveBeenCalled()
    expect(lastInstance).toBeTruthy()
    expect(lastInstance!.continuous).toBe(true)
    expect(lastInstance!.interimResults).toBe(true)
    expect(lastInstance!.lang).toBe(DEFAULT_SPEECH_LANG)
    expect(lastInstance!.start).toHaveBeenCalled()
    expect(v.isListening.value).toBe(true)
    expect(v.error.value).toBeNull()
  })

  it('startListening sets error when offline', () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
    const v = useVoiceToText()
    v.startListening()
    expect(v.error.value?.message).toMatch(/offline/i)
    expect(v.isListening.value).toBe(false)
    expect(MockRec).not.toHaveBeenCalled()
  })

  it('startListening sets error when unsupported', () => {
    delete (window as Window & { SpeechRecognition?: unknown }).SpeechRecognition
    const v = useVoiceToText()
    v.startListening()
    expect(v.error.value?.message).toMatch(/not supported/i)
    expect(v.isListening.value).toBe(false)
    expect(MockRec).not.toHaveBeenCalled()
  })

  it('onresult updates transcript from all results', () => {
    const v = useVoiceToText()
    v.startListening()
    lastInstance!.onresult?.({
      resultIndex: 0,
      results: {
        length: 2,
        0: { isFinal: true, 0: { transcript: 'Hello ' } },
        1: { isFinal: false, 0: { transcript: 'world' } },
      },
    })
    expect(v.transcript.value).toBe('Hello world')
  })

  it('onerror sets error and stops listening flag', () => {
    const v = useVoiceToText()
    v.startListening()
    lastInstance!.onerror?.({ error: 'not-allowed' })
    expect(v.error.value?.message).toContain('not-allowed')
    expect(v.isListening.value).toBe(false)
  })

  it('onend clears isListening', () => {
    const v = useVoiceToText()
    v.startListening()
    lastInstance!.onend?.()
    expect(v.isListening.value).toBe(false)
  })

  it('stopListening calls stop on active recognition', () => {
    const v = useVoiceToText()
    v.startListening()
    v.stopListening()
    expect(lastInstance!.stop).toHaveBeenCalled()
  })

  it('stopListening is safe when never started', () => {
    const v = useVoiceToText()
    v.stopListening()
    expect(v.isListening.value).toBe(false)
  })

  it('clear resets transcript and error', () => {
    const v = useVoiceToText()
    v.startListening()
    lastInstance!.onresult?.({
      resultIndex: 0,
      results: { length: 1, 0: { isFinal: true, 0: { transcript: 'x' } } },
    })
    lastInstance!.onerror?.({ error: 'aborted' })
    v.clear()
    expect(v.transcript.value).toBe('')
    expect(v.error.value).toBeNull()
  })

  it('respects custom lang and speech options', () => {
    const v = useVoiceToText({
      lang: 'en-CA',
      continuous: false,
      interimResults: false,
    })
    v.startListening()
    expect(lastInstance!.lang).toBe('en-CA')
    expect(lastInstance!.continuous).toBe(false)
    expect(lastInstance!.interimResults).toBe(false)
  })

  it('aborts previous session when startListening is called again', () => {
    const v = useVoiceToText()
    v.startListening()
    const first = lastInstance
    v.startListening()
    expect(first!.abort).toHaveBeenCalled()
    expect(lastInstance!.start).toHaveBeenCalled()
  })

  describe('integration (Vue + composable)', () => {
    it('exposes reactive state in a mounted component', async () => {
      let api: ReturnType<typeof useVoiceToText> | null = null
      const View = defineComponent({
        setup() {
          api = useVoiceToText()
          return () => h('div', 'voice')
        },
      })
      mount(View)
      await nextTick()
      if (!api) throw new Error('missing api')
      api.startListening()
      expect(api.isListening.value).toBe(true)
      lastInstance!.onresult?.({
        resultIndex: 0,
        results: { length: 1, 0: { isFinal: true, 0: { transcript: 'note' } } },
      })
      expect(api.transcript.value).toBe('note')
    })
  })
})
