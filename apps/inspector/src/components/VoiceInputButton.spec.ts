import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import VoiceInputButton from './VoiceInputButton.vue'

type MockRecognition = {
  start: ReturnType<typeof vi.fn>
  stop: ReturnType<typeof vi.fn>
  abort: ReturnType<typeof vi.fn>
  onresult: ((ev: unknown) => void) | null
  onerror: ((ev: { error: string }) => void) | null
  onend: (() => void) | null
}

describe('VoiceInputButton', () => {
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

  it('renders microphone idle state', () => {
    const w = mount(VoiceInputButton)
    expect(w.find('[data-testid="voice-input-idle"]').exists()).toBe(true)
    expect(w.find('[data-testid="voice-input-button"]').attributes('disabled')).toBeUndefined()
  })

  it('starts recording on pointerdown and shows recording feedback', async () => {
    const w = mount(VoiceInputButton)
    await w.find('[data-testid="voice-input-button"]').trigger('pointerdown')
    await flushPromises()
    expect(lastInstance?.start).toHaveBeenCalled()
    expect(w.find('[data-testid="voice-input-recording"]').exists()).toBe(true)
  })

  it('stops on pointerup, shows processing, then emits transcript on recognition end', async () => {
    const w = mount(VoiceInputButton)
    await w.find('[data-testid="voice-input-button"]').trigger('pointerdown')
    await flushPromises()
    lastInstance?.onresult?.({
      resultIndex: 0,
      results: { length: 1, 0: { isFinal: true, 0: { transcript: '  hello world  ' } } },
    })
    await w.find('[data-testid="voice-input-button"]').trigger('pointerup')
    await flushPromises()
    expect(lastInstance?.stop).toHaveBeenCalled()
    expect(w.find('[data-testid="voice-input-processing"]').exists()).toBe(true)
    lastInstance?.onend?.()
    await flushPromises()
    expect(w.emitted('transcript')?.[0]).toEqual(['hello world'])
    expect(w.find('[data-testid="voice-input-idle"]').exists()).toBe(true)
  })

  it('does not start when disabled', async () => {
    const w = mount(VoiceInputButton, { props: { disabled: true } })
    await w.find('[data-testid="voice-input-button"]').trigger('pointerdown')
    await flushPromises()
    expect(MockRec).not.toHaveBeenCalled()
  })

  it('shows error state when recognition is unsupported', async () => {
    delete (window as Window & { SpeechRecognition?: unknown }).SpeechRecognition
    const w = mount(VoiceInputButton)
    expect(w.find('[data-testid="voice-input-button"]').attributes('disabled')).toBeDefined()
    expect(w.find('[data-testid="voice-input-unsupported-hint"]').exists()).toBe(true)
    expect(w.find('[data-testid="voice-input-unsupported-hint"]').text()).toMatch(/Chrome|Safari/i)
  })

  it('shows error icon and user-facing panel after failed start (offline)', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
    const w = mount(VoiceInputButton)
    await w.find('[data-testid="voice-input-button"]').trigger('pointerdown')
    await flushPromises()
    expect(w.find('[data-testid="voice-input-error"]').exists()).toBe(true)
    expect(w.find('[data-testid="voice-input-error-panel"]').exists()).toBe(true)
    expect(w.find('[data-testid="voice-input-error-summary"]').text()).toMatch(/internet/i)
    expect(w.find('[data-testid="voice-input-error-resolution"]').text()).toMatch(/Connect|type/i)
  })

  it('shows microphone guidance after not-allowed from recognition', async () => {
    const w = mount(VoiceInputButton)
    await w.find('[data-testid="voice-input-button"]').trigger('pointerdown')
    await flushPromises()
    lastInstance?.onerror?.({ error: 'not-allowed' })
    await flushPromises()
    expect(w.find('[data-testid="voice-input-error-panel"]').exists()).toBe(true)
    expect(w.find('[data-testid="voice-input-error-summary"]').text()).toMatch(
      /microphone|blocked/i,
    )
    expect(w.find('[data-testid="voice-input-error-resolution"]').text()).toMatch(/Allow|settings/i)
  })
})
