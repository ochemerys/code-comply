import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import VoCForm from './VoCForm.vue'
import type { VoCFormPayload } from './voc-form.types'

describe('VoCForm', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  beforeEach(() => {
    vi.useFakeTimers({ now: new Date('2026-05-14T12:00:00Z') })
  })

  it('renders all VoC fields and actions', () => {
    const wrapper = mount(VoCForm, {
      props: { initialSectionTitle: 'NBC §9.10.1 — Fire separation' },
    })
    expect(wrapper.find('[data-testid="voc-form"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="voc-verification-date"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="voc-section-title"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="voc-title"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="voc-name"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="voc-method"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="voc-comments"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="voc-submit"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="voc-cancel"]').exists()).toBe(true)
  })

  it('pre-fills section title and title from props', () => {
    const wrapper = mount(VoCForm, {
      props: {
        initialSectionTitle: 'NBC §9.10.1 — Fire separation',
        initialTitle: 'Fire separation',
      },
    })
    expect(
      (wrapper.find('[data-testid="voc-section-title"]').element as HTMLInputElement).value,
    ).toBe('NBC §9.10.1 — Fire separation')
    expect((wrapper.find('[data-testid="voc-title"]').element as HTMLInputElement).value).toBe(
      'Fire separation',
    )
  })

  it('shows validation errors when required fields are empty', async () => {
    const wrapper = mount(VoCForm)
    await wrapper.find('[data-testid="voc-section-title"]').setValue('')
    await wrapper.find('[data-testid="voc-title"]').setValue('')
    await wrapper.find('[data-testid="voc-name"]').setValue('')
    await wrapper.find('[data-testid="voc-form"]').trigger('submit.prevent')
    await flushPromises()
    expect(wrapper.find('[data-testid="voc-section-title-error"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="voc-title-error"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="voc-name-error"]').exists()).toBe(true)
    expect(wrapper.emitted('submit')).toBeUndefined()
  })

  it('emits submit with validated payload including method', async () => {
    const wrapper = mount(VoCForm, {
      props: { initialSectionTitle: 'NBC §9.10.1' },
    })
    await wrapper.find('[data-testid="voc-title"]').setValue('Fire separation verified')
    await wrapper.find('[data-testid="voc-name"]').setValue('Jane Contractor')
    await wrapper.find('[data-testid="voc-method"]').setValue('SITE_VISIT')
    await wrapper.find('[data-testid="voc-comments"]').setValue('Re-inspected on site.')
    await wrapper.find('[data-testid="voc-form"]').trigger('submit.prevent')
    await flushPromises()
    const emitted = wrapper.emitted('submit')?.[0]?.[0] as VoCFormPayload
    expect(emitted).toMatchObject({
      sectionTitle: 'NBC §9.10.1',
      title: 'Fire separation verified',
      name: 'Jane Contractor',
      method: 'SITE_VISIT',
      comments: 'Re-inspected on site.',
    })
    expect(emitted.verificationDate).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
  })

  it('does not emit submit when readOnly', async () => {
    const wrapper = mount(VoCForm, { props: { readOnly: true } })
    await wrapper.find('[data-testid="voc-form"]').trigger('submit.prevent')
    await flushPromises()
    expect(wrapper.emitted('submit')).toBeUndefined()
  })
})
