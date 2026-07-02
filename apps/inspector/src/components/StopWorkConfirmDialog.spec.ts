import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import StopWorkConfirmDialog from './StopWorkConfirmDialog.vue'
import type { LocalDeficiency } from '@/lib/db/types'

function row(overrides: Partial<LocalDeficiency> = {}): LocalDeficiency {
  return {
    id: 'd1',
    clientId: 'c1',
    inspectionId: 'insp-1',
    createdById: 'u1',
    description: 'Hazardous condition requiring stop work description text.',
    location: 'Roof deck',
    severity: 'CRITICAL',
    status: 'OPEN',
    isStopWork: false,
    isUnsafe: true,
    createdAt: '2026-04-01T10:00:00.000Z',
    updatedAt: '2026-04-02T15:30:00.000Z',
    isDirty: false,
    ...overrides,
  }
}

describe('StopWorkConfirmDialog', () => {
  it('shows consequences copy and deficiency summary when open', () => {
    const w = mount(StopWorkConfirmDialog, {
      props: { modelValue: true, deficiency: row() },
      global: { stubs: { teleport: true } },
    })
    expect(w.find('[data-testid="stop-work-dialog-title"]').text()).toContain('Stop Work')
    expect(w.find('[data-testid="stop-work-dialog-message"]').text()).toContain('administrator')
    expect(w.find('[data-testid="stop-work-dialog-description"]').text()).toContain('Hazardous')
  })

  it('emits confirm', async () => {
    const w = mount(StopWorkConfirmDialog, {
      props: { modelValue: true, deficiency: row() },
      global: { stubs: { teleport: true } },
    })
    await w.find('[data-testid="stop-work-dialog-confirm"]').trigger('click')
    expect(w.emitted('confirm')).toBeTruthy()
  })

  it('emits cancel', async () => {
    const w = mount(StopWorkConfirmDialog, {
      props: { modelValue: true, deficiency: row() },
      global: { stubs: { teleport: true } },
    })
    await w.find('[data-testid="stop-work-dialog-cancel"]').trigger('click')
    expect(w.emitted('cancel')).toBeTruthy()
  })

  it('disables confirm while confirming', () => {
    const w = mount(StopWorkConfirmDialog, {
      props: { modelValue: true, deficiency: row(), confirming: true },
      global: { stubs: { teleport: true } },
    })
    const btn = w.find('[data-testid="stop-work-dialog-confirm"]')
    expect(btn.attributes('disabled')).toBeDefined()
  })
})
