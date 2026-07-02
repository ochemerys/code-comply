import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import StopWorkButton from './StopWorkButton.vue'

describe('StopWorkButton', () => {
  it('renders prominent label and emits request on click', async () => {
    const w = mount(StopWorkButton)
    expect(w.find('[data-testid="stop-work-order-button"]').text()).toContain('Stop work order')
    await w.find('[data-testid="stop-work-order-button"]').trigger('click')
    expect(w.emitted('request')).toBeTruthy()
  })

  it('does not emit when disabled', async () => {
    const w = mount(StopWorkButton, { props: { disabled: true } })
    await w.find('[data-testid="stop-work-order-button"]').trigger('click')
    expect(w.emitted('request')).toBeFalsy()
  })
})
