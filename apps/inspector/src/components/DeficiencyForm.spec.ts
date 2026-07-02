import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, nextTick } from 'vue'
import DeficiencyForm from './DeficiencyForm.vue'
import VoiceInputButton from './VoiceInputButton.vue'
import type { DeficiencyFormPayload } from './deficiency-form.types'
import type { LocalDeficiency } from '@/lib/db/types'

const CodeReferenceModalStub = defineComponent({
  name: 'CodeReferenceModal',
  props: { modelValue: Boolean },
  emits: ['update:modelValue', 'select'],
  template: '<div />',
})

describe('DeficiencyForm', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('pre-fills code reference from initialCreateCodeReference (M6-S13)', () => {
    const wrapper = mount(DeficiencyForm, {
      props: {
        inspectionId: 'insp-1',
        initialCreateCodeReference: { code: 'NBC', section: '9.10.1', title: 'Fire separation' },
      },
      global: { stubs: { CodeReferenceModal: CodeReferenceModalStub } },
    })
    expect(wrapper.find('[data-testid="deficiency-code-summary"]').text()).toContain('NBC')
    expect(wrapper.find('[data-testid="deficiency-code-summary"]').text()).toContain('9.10.1')
  })

  it('renders required fields and actions', () => {
    const wrapper = mount(DeficiencyForm, {
      props: { inspectionId: 'insp-1' },
      global: { stubs: { CodeReferenceModal: CodeReferenceModalStub } },
    })
    expect(wrapper.find('[data-testid="deficiency-form"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="deficiency-description"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="deficiency-severity"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="deficiency-code-open"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="deficiency-location"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="deficiency-due-date"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="deficiency-submit"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="deficiency-cancel"]').exists()).toBe(true)
    expect(wrapper.findComponent(VoiceInputButton).exists()).toBe(true)
  })

  it('shows validation error when description is too short', async () => {
    const wrapper = mount(DeficiencyForm, {
      props: { inspectionId: 'insp-1' },
      global: { stubs: { CodeReferenceModal: CodeReferenceModalStub } },
    })
    await wrapper.find('[data-testid="deficiency-description"]').setValue('short')
    await wrapper.find('[data-testid="deficiency-form"]').trigger('submit.prevent')
    await flushPromises()
    expect(wrapper.find('[data-testid="deficiency-description-error"]').text()).toMatch(
      /10|characters/i,
    )
  })

  it('emits submit with severity and parsed payload', async () => {
    vi.useFakeTimers({ now: new Date('2026-04-03T12:00:00Z') })
    const wrapper = mount(DeficiencyForm, {
      props: { inspectionId: 'insp-99', checklistItemId: 'item-a' },
      global: { stubs: { CodeReferenceModal: CodeReferenceModalStub } },
    })
    await wrapper
      .find('[data-testid="deficiency-description"]')
      .setValue('Fire exit obstructed by stored materials blocking egress path.')
    await wrapper.find('input[type="radio"][value="CRITICAL"]').setValue(true)
    await wrapper.find('[data-testid="deficiency-location"]').setValue('North stair B2')
    await wrapper.find('[data-testid="deficiency-due-date"]').setValue('2026-04-10')
    await wrapper.find('[data-testid="deficiency-form"]').trigger('submit.prevent')
    await flushPromises()
    const emitted = wrapper.emitted('submit')?.[0]?.[0] as DeficiencyFormPayload
    expect(emitted).toMatchObject({
      inspectionId: 'insp-99',
      checklistItemId: 'item-a',
      severity: 'CRITICAL',
      location: 'North stair B2',
      dueDate: '2026-04-10T12:00:00.000Z',
      isStopWork: false,
      isUnsafe: false,
    })
    expect(emitted?.description.length).toBeGreaterThanOrEqual(10)
  })

  it('submits isUnsafe true when Unsafe toggle is on (M6-S16)', async () => {
    vi.useFakeTimers({ now: new Date('2026-04-03T12:00:00Z') })
    const wrapper = mount(DeficiencyForm, {
      props: { inspectionId: 'insp-1' },
      global: { stubs: { CodeReferenceModal: CodeReferenceModalStub } },
    })
    await wrapper
      .find('[data-testid="deficiency-description"]')
      .setValue('Blocked exit path requires attention on site today.')
    await wrapper.find('[data-testid="deficiency-flag-unsafe"]').setValue(true)
    await wrapper.find('[data-testid="deficiency-form"]').trigger('submit.prevent')
    await flushPromises()
    const payload = wrapper.emitted('submit')?.[0]?.[0] as DeficiencyFormPayload
    expect(payload.isUnsafe).toBe(true)
  })

  it('rejects due date that is not in the future', async () => {
    vi.useFakeTimers({ now: new Date('2026-04-03T12:00:00Z') })
    const wrapper = mount(DeficiencyForm, {
      props: { inspectionId: 'insp-1' },
      global: { stubs: { CodeReferenceModal: CodeReferenceModalStub } },
    })
    await wrapper
      .find('[data-testid="deficiency-description"]')
      .setValue('Valid description text for deficiency reporting minimum length.')
    await wrapper.find('[data-testid="deficiency-due-date"]').setValue('2026-04-03')
    await wrapper.find('[data-testid="deficiency-form"]').trigger('submit.prevent')
    await flushPromises()
    expect(wrapper.emitted('submit')).toBeFalsy()
    expect(wrapper.find('[data-testid="deficiency-due-date-error"]').text()).toMatch(/future/i)
  })

  it('includes code reference after modal selection', async () => {
    vi.useFakeTimers({ now: new Date('2026-04-03T12:00:00Z') })
    const ModalPick = defineComponent({
      name: 'CodeReferenceModal',
      props: { modelValue: Boolean },
      emits: ['update:modelValue', 'select'],
      template:
        '<button v-if="modelValue" type="button" data-testid="stub-pick-code" @click="$emit(\'select\', { code: \'NBC\', section: \'9.10.1\', title: \'Fire separation\' })">pick</button>',
    })
    const wrapper = mount(DeficiencyForm, {
      props: { inspectionId: 'insp-1' },
      global: { stubs: { CodeReferenceModal: ModalPick } },
    })
    await wrapper.find('[data-testid="deficiency-code-open"]').trigger('click')
    await nextTick()
    await wrapper.find('[data-testid="stub-pick-code"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="deficiency-code-summary"]').text()).toContain('NBC')

    await wrapper
      .find('[data-testid="deficiency-description"]')
      .setValue('Wall assembly missing required fire rating at corridor.')
    await wrapper.find('[data-testid="deficiency-form"]').trigger('submit.prevent')
    await flushPromises()
    const payload = wrapper.emitted('submit')?.[0]?.[0] as DeficiencyFormPayload
    expect(payload.codeReference).toEqual(
      expect.objectContaining({ code: 'NBC', section: '9.10.1', title: 'Fire separation' }),
    )
  })

  it('emits cancel when Cancel is pressed', async () => {
    const wrapper = mount(DeficiencyForm, {
      props: { inspectionId: 'insp-1' },
      global: { stubs: { CodeReferenceModal: CodeReferenceModalStub } },
    })
    await wrapper.find('[data-testid="deficiency-cancel"]').trigger('click')
    expect(wrapper.emitted('cancel')).toBeTruthy()
  })

  it('edit mode keeps a past due date when unchanged and labels submit Save changes', async () => {
    vi.useFakeTimers({ now: new Date('2026-04-03T12:00:00Z') })
    const initial: LocalDeficiency = {
      id: 'd1',
      clientId: 'c1',
      inspectionId: 'insp-1',
      createdById: 'u1',
      description: 'Existing deficiency description text here ok.',
      location: 'North wing',
      severity: 'MINOR',
      status: 'OPEN',
      isStopWork: false,
      isUnsafe: false,
      dueDate: '2026-03-01T12:00:00.000Z',
      createdAt: '2026-03-01T10:00:00.000Z',
      updatedAt: '2026-03-01T10:00:00.000Z',
      isDirty: false,
    }
    const wrapper = mount(DeficiencyForm, {
      props: { inspectionId: 'insp-1', variant: 'edit', initialDeficiency: initial },
      global: { stubs: { CodeReferenceModal: CodeReferenceModalStub } },
    })
    await flushPromises()
    expect(wrapper.find('[data-testid="deficiency-submit"]').text()).toMatch(/Save changes/i)
    await wrapper.find('[data-testid="deficiency-form"]').trigger('submit.prevent')
    await flushPromises()
    const payload = wrapper.emitted('submit')?.[0]?.[0] as DeficiencyFormPayload
    expect(payload).toMatchObject({
      inspectionId: 'insp-1',
      severity: 'MINOR',
      location: 'North wing',
      dueDate: '2026-03-01T12:00:00.000Z',
    })
  })

  it('edit mode locks Stop Work checkbox and always submits isStopWork true when already issued', async () => {
    vi.useFakeTimers({ now: new Date('2026-04-03T12:00:00Z') })
    const initial: LocalDeficiency = {
      id: 'd1',
      clientId: 'c1',
      inspectionId: 'insp-1',
      createdById: 'u1',
      description: 'Existing deficiency description text here ok.',
      location: 'North wing',
      severity: 'MINOR',
      status: 'OPEN',
      isStopWork: true,
      isUnsafe: false,
      createdAt: '2026-03-01T10:00:00.000Z',
      updatedAt: '2026-03-01T10:00:00.000Z',
      isDirty: false,
    }
    const wrapper = mount(DeficiencyForm, {
      props: { inspectionId: 'insp-1', variant: 'edit', initialDeficiency: initial },
      global: { stubs: { CodeReferenceModal: CodeReferenceModalStub } },
    })
    await flushPromises()
    const cb = wrapper.find('[data-testid="deficiency-flag-stop-work"]')
    expect(cb.attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-testid="deficiency-flag-stop-work-locked-hint"]').exists()).toBe(
      true,
    )

    await wrapper.find('[data-testid="deficiency-form"]').trigger('submit.prevent')
    await flushPromises()
    const payload = wrapper.emitted('submit')?.[0]?.[0] as DeficiencyFormPayload
    expect(payload.isStopWork).toBe(true)
  })

  describe('voice input on description (M7-S14)', () => {
    type MockRecognition = {
      start: ReturnType<typeof vi.fn>
      stop: ReturnType<typeof vi.fn>
      abort: ReturnType<typeof vi.fn>
      onresult: ((ev: unknown) => void) | null
      onerror: ((ev: { error: string }) => void) | null
      onend: (() => void) | null
    }
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

    it('appends dictated transcript to description after press-hold-release', async () => {
      const wrapper = mount(DeficiencyForm, {
        props: { inspectionId: 'insp-1' },
        global: { stubs: { CodeReferenceModal: CodeReferenceModalStub } },
      })
      const ta = wrapper.find('[data-testid="deficiency-description"]')
      await ta.setValue('Initial note.')
      const voiceBtn = wrapper.find('[data-testid="voice-input-button"]')
      await voiceBtn.trigger('pointerdown')
      await flushPromises()
      lastInstance?.onresult?.({
        resultIndex: 0,
        results: { length: 1, 0: { isFinal: true, 0: { transcript: 'Second sentence.' } } },
      })
      await voiceBtn.trigger('pointerup')
      await flushPromises()
      lastInstance?.onend?.()
      await flushPromises()
      expect((ta.element as HTMLTextAreaElement).value).toBe('Initial note. Second sentence.')
    })
  })
})
