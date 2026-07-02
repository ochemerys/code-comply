import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import type { CertificationDTO } from '@codecomply/validators'
import CertificationEditor from './CertificationEditor.vue'

const issued = '2024-01-15T12:00:00.000Z'

const oneCert = (): CertificationDTO[] => [
  {
    id: 'c1',
    discipline: 'Electrical',
    authority: 'State',
    issuedDate: issued,
    status: 'ACTIVE',
  },
]

describe('CertificationEditor', () => {
  it('renders rows from model', () => {
    const wrapper = mount(CertificationEditor, {
      props: {
        modelValue: oneCert(),
        'onUpdate:modelValue': () => {},
      },
    })
    expect(
      (wrapper.get('[data-testid="cert-discipline-0"]').element as HTMLInputElement).value,
    ).toBe('Electrical')
  })

  it('adds a row when Add certification is clicked', async () => {
    const onUpdate = vi.fn()
    const wrapper = mount(CertificationEditor, {
      props: {
        modelValue: [],
        'onUpdate:modelValue': onUpdate,
      },
    })
    await wrapper.get('[data-testid="certification-add"]').trigger('click')
    expect(onUpdate).toHaveBeenCalled()
    const next = onUpdate.mock.calls[0]?.[0] as CertificationDTO[]
    expect(next.length).toBe(1)
    expect(next[0].discipline).toBe('')
    expect(next[0].status).toBe('ACTIVE')
  })

  it('removes a row', async () => {
    const onUpdate = vi.fn()
    const wrapper = mount(CertificationEditor, {
      props: {
        modelValue: oneCert(),
        'onUpdate:modelValue': onUpdate,
      },
    })
    await wrapper.get('[data-testid="cert-remove-0"]').trigger('click')
    expect(onUpdate).toHaveBeenCalledWith([])
  })
})
