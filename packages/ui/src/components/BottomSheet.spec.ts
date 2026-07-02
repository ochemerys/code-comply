import { afterEach, describe, it, expect } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import BottomSheet from './BottomSheet.vue'

enableAutoUnmount(afterEach)

function mountSheet(props: Record<string, unknown> = {}) {
  return mount(BottomSheet, {
    props: { modelValue: true, ...props },
    attrs: { 'data-testid': 'sheet' },
    slots: {
      default:
        '<h2 id="sheet-title">Title</h2><button type="button" data-testid="first-action">Done</button>',
    },
    global: { stubs: { teleport: true } },
  })
}

describe('BottomSheet', () => {
  it('renders a labelled dialog with a phone drag handle', () => {
    const wrapper = mountSheet({ labelledBy: 'sheet-title', overlayTestId: 'sheet-overlay' })

    expect(wrapper.get('[data-testid="sheet"]').attributes('role')).toBe('dialog')
    expect(wrapper.get('[data-testid="sheet"]').attributes('aria-labelledby')).toBe('sheet-title')
    expect(wrapper.get('[data-testid="bottom-sheet-drag-handle"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="sheet-overlay"]').classes()).toContain('items-end')
  })

  it('emits close and model update on backdrop click', async () => {
    const wrapper = mountSheet({ overlayTestId: 'sheet-overlay' })

    await wrapper.get('[data-testid="sheet-overlay"]').trigger('click')

    expect(wrapper.emitted('close')).toBeTruthy()
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([false])
  })

  it('does not close when dismissed interactions are disabled', async () => {
    const wrapper = mountSheet({ dismissible: false, overlayTestId: 'sheet-overlay' })

    await wrapper.get('[data-testid="sheet-overlay"]').trigger('click')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))

    expect(wrapper.emitted('close')).toBeFalsy()
    expect(wrapper.emitted('update:modelValue')).toBeFalsy()
  })

  it('closes when dragged past half of the panel height', async () => {
    const wrapper = mountSheet()
    const panel = wrapper.get('[data-testid="sheet"]').element as HTMLElement
    Object.defineProperty(panel, 'offsetHeight', { configurable: true, value: 400 })

    wrapper
      .get('[data-testid="bottom-sheet-drag-handle"]')
      .element.dispatchEvent(new MouseEvent('pointerdown', { clientY: 0, bubbles: true }))
    window.dispatchEvent(new MouseEvent('pointermove', { clientY: 220 }))
    window.dispatchEvent(new MouseEvent('pointerup'))

    expect(wrapper.emitted('close')).toBeTruthy()
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([false])
  })

  it('only releases scroll lock acquired by the same sheet instance', () => {
    const openSheet = mountSheet()
    expect(document.body.style.overflow).toBe('hidden')

    const closedSheet = mountSheet({ modelValue: false })
    expect(document.body.style.overflow).toBe('hidden')

    closedSheet.unmount()
    expect(document.body.style.overflow).toBe('hidden')

    openSheet.unmount()
    expect(document.body.style.overflow).toBe('')
  })
})
