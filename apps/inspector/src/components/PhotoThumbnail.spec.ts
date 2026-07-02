import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import PhotoThumbnail from './PhotoThumbnail.vue'

describe('PhotoThumbnail (M7-S13)', () => {
  it('emits click when activated', async () => {
    const w = mount(PhotoThumbnail, {
      props: { src: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=', alt: 'Test' },
    })
    await w.find('[data-testid="photo-thumbnail"]').trigger('click')
    expect(w.emitted('click')).toBeTruthy()
  })

  it('emits click on Enter key', async () => {
    const w = mount(PhotoThumbnail, {
      props: { src: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=', alt: 'Test' },
    })
    await w.find('[data-testid="photo-thumbnail"]').trigger('keydown', { key: 'Enter' })
    expect(w.emitted('click')).toBeTruthy()
  })

  it('calls preventDefault on Space key', async () => {
    const w = mount(PhotoThumbnail, {
      props: { src: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=', alt: 'Test' },
    })
    const prevent = vi.fn()
    await w.find('[data-testid="photo-thumbnail"]').trigger('keydown', {
      key: ' ',
      preventDefault: prevent,
    })
    expect(prevent).toHaveBeenCalled()
    expect(w.emitted('click')).toBeTruthy()
  })
})
