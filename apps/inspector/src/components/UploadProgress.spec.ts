/**
 * Unit tests for UploadProgress (M7-S15).
 *
 * @see Testing Strategy — Frontend component testing
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import UploadProgress from './UploadProgress.vue'
import type { UploadProgressItem } from './UploadProgress.vue'

const sampleItems: UploadProgressItem[] = [
  { id: 'a', status: 'pending', label: 'a.jpg' },
  { id: 'b', status: 'uploading', progress: 50, label: 'b.jpg' },
  { id: 'c', status: 'uploaded', label: 'c.jpg' },
]

describe('UploadProgress', () => {
  it('renders progress bar and percentage from item states', () => {
    const w = mount(UploadProgress, {
      props: {
        items: sampleItems,
      },
    })
    expect(w.find('[data-testid="upload-progress-bar"]').exists()).toBe(true)
    expect(w.find('[data-testid="upload-percent-text"]').text()).toMatch(/\d+%/)
    const fill = w.find('[data-testid="upload-progress-bar-fill"]')
    expect(fill.attributes('style')).toContain('width:')
  })

  it('shows pending, uploaded, and failed counts', () => {
    const list: UploadProgressItem[] = [
      { id: 'p1', status: 'pending' },
      { id: 'p2', status: 'pending' },
      { id: 'u1', status: 'uploaded' },
      { id: 'f1', status: 'failed' },
    ]
    const w = mount(UploadProgress, { props: { items: list } })
    expect(w.find('[data-testid="upload-count-pending"]').text()).toContain('2')
    expect(w.find('[data-testid="upload-count-uploaded"]').text()).toContain('1')
    expect(w.find('[data-testid="upload-count-failed"]').text()).toContain('1')
  })

  it('highlights failed count when there are failures', () => {
    const w = mount(UploadProgress, {
      props: {
        items: [{ id: 'f1', status: 'failed' }],
      },
    })
    const failed = w.find('[data-testid="upload-count-failed"]')
    expect(failed.classes().some((c) => c.includes('red'))).toBe(true)
    expect(w.find('[data-testid="upload-failed-section"]').exists()).toBe(true)
    expect(w.find('[data-testid="upload-failed-row-f1"]').exists()).toBe(true)
  })

  it('emits retry with id when Retry is clicked', async () => {
    const w = mount(UploadProgress, {
      props: {
        items: [{ id: 'x', status: 'failed', label: 'x.png' }],
      },
    })
    await w.find('[data-testid="upload-retry-x"]').trigger('click')
    expect(w.emitted('retry')?.[0]).toEqual(['x'])
  })

  it('emits cancel with id when Cancel is clicked for pending', async () => {
    const w = mount(UploadProgress, {
      props: {
        items: [{ id: 'y', status: 'pending' }],
      },
    })
    await w.find('[data-testid="upload-cancel-y"]').trigger('click')
    expect(w.emitted('cancel')?.[0]).toEqual(['y'])
  })

  it('computes overall percent as average contribution per item', () => {
    const list: UploadProgressItem[] = [
      { id: '1', status: 'uploaded' },
      { id: '2', status: 'uploaded' },
      { id: '3', status: 'pending' },
      { id: '4', status: 'pending' },
    ]
    const w = mount(UploadProgress, { props: { items: list } })
    expect(w.find('[data-testid="upload-percent-text"]').text()).toBe('50%')
  })

  it('exposes progressbar semantics', () => {
    const w = mount(UploadProgress, {
      props: { items: [{ id: '1', status: 'uploaded' }] },
    })
    const bar = w.find('[data-testid="upload-progress-bar"]')
    expect(bar.attributes('role')).toBe('progressbar')
    expect(bar.attributes('aria-valuemin')).toBe('0')
    expect(bar.attributes('aria-valuemax')).toBe('100')
    expect(bar.attributes('aria-valuenow')).toBeDefined()
  })
})
