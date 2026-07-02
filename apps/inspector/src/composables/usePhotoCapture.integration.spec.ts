/**
 * Integration-style tests: composable + Vue reactivity + DOM pipeline (mocked camera).
 * @see _docs/development/01-governance/testing-strategy.md — composable integration coverage.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { defineComponent, h, toRaw } from 'vue'
import { mount } from '@vue/test-utils'
import { usePhotoCapture } from './usePhotoCapture'

function createMockStream(): MediaStream {
  const track = { stop: vi.fn(), kind: 'video' } as unknown as MediaStreamTrack
  return {
    getTracks: () => [track],
    getVideoTracks: () => [track],
  } as unknown as MediaStream
}

describe('usePhotoCapture (integration)', () => {
  let getUserMedia: ReturnType<typeof vi.fn>

  beforeEach(() => {
    getUserMedia = vi.fn()
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      writable: true,
      value: { getUserMedia },
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('runs start → capture → stop inside a mounted component', async () => {
    const mockBlob = new Blob(['jpeg'], { type: 'image/jpeg' })
    const mockStream = createMockStream()
    getUserMedia.mockResolvedValue(mockStream)

    const originalCreate = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'video') {
        const v = originalCreate('video') as HTMLVideoElement
        Object.defineProperty(v, 'videoWidth', { value: 4, configurable: true })
        Object.defineProperty(v, 'videoHeight', { value: 4, configurable: true })
        v.play = vi.fn().mockResolvedValue(undefined)
        queueMicrotask(() => v.dispatchEvent(new Event('loadedmetadata')))
        return v
      }
      if (tag === 'canvas') {
        const c = originalCreate('canvas') as HTMLCanvasElement
        c.getContext = vi.fn().mockReturnValue({ drawImage: vi.fn() })
        c.toBlob = vi.fn((cb: BlobCallback | null) => {
          if (cb) cb(mockBlob)
        })
        return c
      }
      return originalCreate(tag)
    })

    let api: ReturnType<typeof usePhotoCapture> | null = null

    const TestView = defineComponent({
      setup() {
        api = usePhotoCapture()
        return () => h('div')
      },
    })

    mount(TestView)
    if (!api) throw new Error('composable not initialized')

    await api.startCamera()
    expect(toRaw(api.stream.value)).toBe(mockStream)

    const blob = await api.capturePhoto()
    expect(blob.type).toBe('image/jpeg')
    expect(api.photo.value).toBeTruthy()

    await api.stopCamera()
    expect(api.stream.value).toBeNull()
    expect(mockStream.getTracks()[0].stop).toHaveBeenCalled()
  })
})
