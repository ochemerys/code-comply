/**
 * Integration: Stop Work CTA + StopWorkConfirmDialog wiring (M6-S15).
 */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import DeficiencyDetails from '@/components/DeficiencyDetails.vue'
import StopWorkConfirmDialog from '@/components/StopWorkConfirmDialog.vue'
import type { LocalDeficiency } from '@/lib/db/types'

function mockRow(): LocalDeficiency {
  const now = new Date().toISOString()
  return {
    id: 'def-int-sw',
    clientId: 'c-int',
    inspectionId: 'insp-int',
    createdById: 'u1',
    description: 'Integration test deficiency summary text for stop work confirmation workflow.',
    location: 'South stair',
    severity: 'CRITICAL',
    status: 'OPEN',
    isStopWork: false,
    isUnsafe: false,
    createdAt: now,
    updatedAt: now,
    isDirty: false,
    syncedAt: now,
  }
}

const Harness = defineComponent({
  components: { DeficiencyDetails, StopWorkConfirmDialog },
  props: {
    confirming: { type: Boolean, default: false },
    error: { type: String as () => string | null, default: null },
  },
  setup() {
    const row = mockRow()
    return { row }
  },
  data: () => ({
    dialogOpen: false,
    confirmed: false,
  }),
  template: `
    <div>
      <DeficiencyDetails
        :deficiency="row"
        :status-history="[]"
        :action-busy="confirming"
        @stop-work-request="dialogOpen = true"
      />
      <StopWorkConfirmDialog
        v-model="dialogOpen"
        :deficiency="row"
        :confirming="confirming"
        :error="error"
        @confirm="confirmed = true"
        @cancel="dialogOpen = false"
      />
    </div>
  `,
})

describe('Stop Work dialog workflow (integration)', () => {
  it('opens dialog from Stop Work button with consequence copy', async () => {
    const wrapper = mount(Harness, {
      global: { stubs: { teleport: true } },
    })
    await wrapper.find('[data-testid="stop-work-order-button"]').trigger('click')
    expect(wrapper.find('[data-testid="stop-work-confirm-dialog"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="stop-work-dialog-message"]').text()).toContain(
      'notification',
    )
    expect(wrapper.find('[data-testid="stop-work-dialog-description"]').text()).toContain(
      'Integration test deficiency',
    )
  })

  it('confirm sets harness flag', async () => {
    const wrapper = mount(Harness, {
      global: { stubs: { teleport: true } },
    })
    await wrapper.find('[data-testid="stop-work-order-button"]').trigger('click')
    await wrapper.find('[data-testid="stop-work-dialog-confirm"]').trigger('click')
    expect((wrapper.vm as { confirmed: boolean }).confirmed).toBe(true)
  })
})
