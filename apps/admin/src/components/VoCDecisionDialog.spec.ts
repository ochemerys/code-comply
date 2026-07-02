import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import type { Pinia } from 'pinia'
import { createPinia, setActivePinia } from 'pinia'
import type { UserDTO, VoCDTO } from '@codecomply/validators'
import VoCDecisionDialog from './VoCDecisionDialog.vue'
import { useAuthStore } from '../stores/auth'

const iso = () => new Date().toISOString()

const adminUser = (): UserDTO => ({
  id: 'admin',
  email: 'admin@test.com',
  name: 'Admin',
  role: 'ADMIN',
  disciplines: [],
  certifications: [],
  createdAt: iso(),
  updatedAt: iso(),
})

const sampleVoc = (): VoCDTO => ({
  id: 'voc-1',
  deficiencyId: 'def-1',
  verificationDate: iso(),
  sectionTitle: '9.8',
  title: 'Guard missing',
  name: 'Jane Owner',
  method: 'SITE_VISIT',
  comments: 'Fixed on site',
  submittedAt: iso(),
  status: 'PENDING',
})

describe('VoCDecisionDialog', () => {
  let pinia: Pinia

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    const auth = useAuthStore()
    auth.setUser(adminUser())
    auth.updateTokens({ accessToken: 'tok', refreshToken: 'ref', expiresIn: 3600 })
    vi.restoreAllMocks()
  })

  it('emits confirm with comments when accept is confirmed', async () => {
    const voc = sampleVoc()
    const wrapper = mount(VoCDecisionDialog, {
      props: {
        open: true,
        voc,
        decision: 'ACCEPTED',
        submitting: false,
        errorMessage: null,
      },
      global: { plugins: [pinia] },
      attachTo: document.body,
    })

    await wrapper.get('[data-testid="voc-decision-comments"]').setValue('Looks compliant')
    await wrapper.get('[data-testid="voc-decision-confirm-accept"]').trigger('click')

    expect(wrapper.emitted('confirm')?.[0]).toEqual([{ comments: 'Looks compliant' }])

    wrapper.unmount()
  })

  it('emits update:open false when cancel is clicked', async () => {
    const voc = sampleVoc()
    const wrapper = mount(VoCDecisionDialog, {
      props: {
        open: true,
        voc,
        decision: 'REJECTED',
        submitting: false,
        errorMessage: null,
      },
      global: { plugins: [pinia] },
    })

    await wrapper.get('[data-testid="voc-decision-cancel"]').trigger('click')
    expect(wrapper.emitted('update:open')?.[0]).toEqual([false])
  })

  it('shows server error text when provided', () => {
    const voc = sampleVoc()
    const wrapper = mount(VoCDecisionDialog, {
      props: {
        open: true,
        voc,
        decision: 'REJECTED',
        submitting: false,
        errorMessage: 'VoC not pending',
      },
      global: { plugins: [pinia] },
    })

    expect(wrapper.get('[data-testid="voc-decision-error"]').text()).toContain('VoC not pending')
  })
})
