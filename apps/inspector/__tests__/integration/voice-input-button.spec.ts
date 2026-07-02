/**
 * Integration — VoiceInputButton + useVoiceToText (M7-S14), Web Speech API mocked.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import VoiceInputButton from '@/components/VoiceInputButton.vue'

type MockRecognition = {
  start: ReturnType<typeof vi.fn>
  stop: ReturnType<typeof vi.fn>
  abort: ReturnType<typeof vi.fn>
  onresult: ((ev: unknown) => void) | null
  onerror: ((ev: { error: string }) => void) | null
  onend: (() => void) | null
}

describe('VoiceInputButton integration', () => {
  let MockRec: { new (): MockRecognition }
  let lastInstance: MockRecognition | null

  beforeEach(() => {
    lastInstance = null
    MockRec = vi.fn().mockImplementation(function (this: Record<string, unknown>) {
      const inst: MockRecognition = {
        start: vi.fn(),
        stop: vi.fn(),
        abort: vi.fn(),
        onresult: null,
        onerror: null,
        onend: null,
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

  it('parent form receives transcript after press-hold-release gesture', async () => {
    const field = ref('')
    const Form = defineComponent({
      setup() {
        function onTranscript(t: string) {
          field.value = field.value ? `${field.value} ${t}` : t
        }
        return () =>
          h('div', [
            h('input', { 'data-testid': 'notes', value: field.value }),
            h(VoiceInputButton, { onTranscript }),
          ])
      },
    })
    const w = mount(Form)
    const inner = w.findComponent(VoiceInputButton)
    const btn = inner.find('[data-testid="voice-input-button"]')

    await btn.trigger('pointerdown')
    await flushPromises()
    lastInstance?.onresult?.({
      resultIndex: 0,
      results: { length: 1, 0: { isFinal: true, 0: { transcript: 'north stairwell' } } },
    })
    await btn.trigger('pointerup')
    await flushPromises()
    lastInstance?.onend?.()
    await flushPromises()

    expect(inner.emitted('transcript')?.[0]).toEqual(['north stairwell'])
    expect(field.value).toBe('north stairwell')
  })

  it('clears visual recording state after recognition error mid-hold without emitting', async () => {
    const w = mount(VoiceInputButton)
    const btn = w.find('[data-testid="voice-input-button"]')
    await btn.trigger('pointerdown')
    await flushPromises()
    lastInstance?.onerror?.({ error: 'not-allowed' })
    await flushPromises()
    expect(w.find('[data-testid="voice-input-error"]').exists()).toBe(true)
    await btn.trigger('pointerup')
    await flushPromises()
    expect(w.emitted('transcript')).toBeFalsy()
  })
})
