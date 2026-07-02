import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import NextFailedButton from './NextFailedButton.vue'

function setupDomTarget(id: string) {
  const el = document.createElement('div')
  el.id = `checklist-item-${id}`
  el.getBoundingClientRect = vi.fn(() => ({ top: 400 }) as any)
  document.body.appendChild(el)
  return el
}

describe('NextFailedButton', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('is disabled when there are no failed items', async () => {
    const nextFailedId = vi.fn(() => null)
    const wrapper = mount(NextFailedButton, {
      props: { failedCount: 0, nextFailedId },
    })
    const btn = wrapper.get('[data-testid="checklist-next-failed"]')
    expect((btn.element as HTMLButtonElement).disabled).toBe(true)
    await btn.trigger('click')
    expect(nextFailedId).not.toHaveBeenCalled()
  })

  it('scrolls to next failed item with smooth scroll + offset', async () => {
    const container = document.createElement('div')
    container.scrollTop = 250
    container.getBoundingClientRect = vi.fn(() => ({ top: 100 }) as any)
    container.scrollTo = vi.fn() as unknown as typeof container.scrollTo
    document.body.appendChild(container)

    setupDomTarget('item-1')

    const nextFailedId = vi.fn(() => 'item-1')
    const wrapper = mount(NextFailedButton, {
      props: {
        failedCount: 1,
        nextFailedId,
        scrollContainer: container,
        offsetPx: 100,
      },
    })

    await wrapper.get('[data-testid="checklist-next-failed"]').trigger('click')

    expect(nextFailedId).toHaveBeenCalledTimes(1)
    expect(container.scrollTo).toHaveBeenCalledWith({ top: 450, behavior: 'smooth' })
  })

  it('highlights the target item and clears highlight after duration', async () => {
    const container = document.createElement('div')
    container.scrollTop = 0
    container.getBoundingClientRect = vi.fn(() => ({ top: 0 }) as any)
    container.scrollTo = vi.fn() as unknown as typeof container.scrollTo
    document.body.appendChild(container)

    const target = setupDomTarget('item-1')

    const wrapper = mount(NextFailedButton, {
      props: {
        failedCount: 1,
        nextFailedId: () => 'item-1',
        scrollContainer: container,
        highlightDurationMs: 2000,
      },
    })

    await wrapper.get('[data-testid="checklist-next-failed"]').trigger('click')
    expect(target.classList.contains('ring-2')).toBe(true)
    expect(target.classList.contains('ring-primary')).toBe(true)

    vi.advanceTimersByTime(1999)
    expect(target.classList.contains('ring-2')).toBe(true)

    vi.advanceTimersByTime(1)
    expect(target.classList.contains('ring-2')).toBe(false)
    expect(target.classList.contains('ring-primary')).toBe(false)
  })
})
