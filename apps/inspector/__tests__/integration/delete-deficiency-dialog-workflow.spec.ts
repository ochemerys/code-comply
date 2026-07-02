/**
 * Integration: DeleteDeficiencyDialog + DeficiencyDetails delete entry point (M6-S11).
 */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import DeficiencyDetails from '@/components/DeficiencyDetails.vue'
import DeleteDeficiencyDialog from '@/components/DeleteDeficiencyDialog.vue'
import type { LocalDeficiency } from '@/lib/db/types'

function mockRow(): LocalDeficiency {
  const now = new Date().toISOString()
  return {
    id: 'def-int-del',
    clientId: 'c-int',
    inspectionId: 'insp-int',
    createdById: 'u1',
    description: 'Integration test deficiency summary text for delete confirmation.',
    location: 'North wing',
    severity: 'MAJOR',
    status: 'OPEN',
    codeReference: { code: 'ABC', section: '1.2', title: 'Fire separation' },
    isStopWork: false,
    isUnsafe: false,
    dueDate: undefined,
    createdAt: now,
    updatedAt: now,
    isDirty: false,
    syncedAt: now,
  }
}

const Harness = defineComponent({
  components: { DeficiencyDetails, DeleteDeficiencyDialog },
  props: {
    deleting: { type: Boolean, default: false },
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
        :action-busy="deleting"
        @delete-request="dialogOpen = true"
      />
      <DeleteDeficiencyDialog
        v-model="dialogOpen"
        :deficiency="row"
        :deleting="deleting"
        :error="error"
        @confirm="confirmed = true"
        @cancel="dialogOpen = false"
      />
    </div>
  `,
})

describe('Delete deficiency dialog workflow (integration)', () => {
  it('opens dialog from DeficiencyDetails delete and shows matching summary', async () => {
    const wrapper = mount(Harness, {
      global: { stubs: { teleport: true } },
    })
    await wrapper.find('[data-testid="deficiency-detail-delete"]').trigger('click')
    expect(wrapper.find('[data-testid="delete-deficiency-dialog"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="delete-deficiency-dialog-description"]').text()).toContain(
      'Integration test deficiency',
    )
    expect(wrapper.find('[data-testid="delete-deficiency-dialog-severity"]').text()).toContain(
      'Major',
    )
  })

  it('confirm sets harness flag and cancel closes dialog', async () => {
    const wrapper = mount(Harness, {
      global: { stubs: { teleport: true } },
    })
    await wrapper.find('[data-testid="deficiency-detail-delete"]').trigger('click')
    await wrapper.find('[data-testid="delete-deficiency-dialog-confirm"]').trigger('click')
    expect((wrapper.vm as { confirmed: boolean }).confirmed).toBe(true)

    await wrapper.find('[data-testid="deficiency-detail-delete"]').trigger('click')
    await wrapper.find('[data-testid="delete-deficiency-dialog-cancel"]').trigger('click')
    expect(wrapper.find('[data-testid="delete-deficiency-dialog"]').exists()).toBe(false)
  })

  it('surfaces API-style error text inside the dialog', async () => {
    const wrapper = mount(Harness, {
      props: { error: 'Server rejected delete' },
      global: { stubs: { teleport: true } },
    })
    await wrapper.find('[data-testid="deficiency-detail-delete"]').trigger('click')
    expect(wrapper.find('[data-testid="delete-deficiency-dialog-error"]').text()).toContain(
      'Server rejected',
    )
  })
})
