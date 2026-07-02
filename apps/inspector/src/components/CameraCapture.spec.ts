import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref, nextTick } from 'vue'
import CameraCapture from './CameraCapture.vue'

const mockStartCamera = vi.fn()
const mockCapturePhoto = vi.fn()
const mockStopCamera = vi.fn()
const mockToggleFacingMode = vi.fn()

const stream = ref<MediaStream | null>(null)
const photo = ref<Blob | null>(null)
const isCapturing = ref(false)
const error = ref<Error | null>(null)

vi.mock('@/composables/usePhotoCapture', () => ({
  usePhotoCapture: () => ({
    stream,
    photo,
    isCapturing,
    error,
    startCamera: mockStartCamera,
    capturePhoto: mockCapturePhoto,
    stopCamera: mockStopCamera,
    toggleFacingMode: mockToggleFacingMode,
  }),
}))

function createFakeStream(caps: { torch?: boolean } = {}): MediaStream {
  const track = {
    stop: vi.fn(),
    kind: 'video',
    getCapabilities: () => caps,
  } as unknown as MediaStreamTrack
  return {
    getTracks: () => [track],
    getVideoTracks: () => [track],
  } as unknown as MediaStream
}

describe('CameraCapture', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStartCamera.mockResolvedValue(undefined)
    mockStopCamera.mockResolvedValue(undefined)
    mockToggleFacingMode.mockResolvedValue(undefined)
    stream.value = createFakeStream()
    photo.value = null
    isCapturing.value = false
    error.value = null
  })

  afterEach(() => {
    stream.value = null
  })

  it('starts the camera on mount', () => {
    mount(CameraCapture)
    expect(mockStartCamera).toHaveBeenCalledTimes(1)
  })

  it('renders the viewfinder element', () => {
    const wrapper = mount(CameraCapture)
    expect(wrapper.find('[data-testid="camera-viewfinder"]').exists()).toBe(true)
  })

  it('invokes capture when the shutter is pressed and shows preview', async () => {
    const jpeg = new Blob(['fake'], { type: 'image/jpeg' })
    mockCapturePhoto.mockImplementation(async () => {
      photo.value = jpeg
      return jpeg
    })
    const wrapper = mount(CameraCapture)
    await wrapper.find('[data-testid="camera-shutter"]').trigger('click')
    await flushPromises()
    expect(mockCapturePhoto).toHaveBeenCalledTimes(1)
    expect(wrapper.find('[data-testid="camera-preview"]').exists()).toBe(true)
  })

  it('retake clears preview and returns to live view', async () => {
    const jpeg = new Blob(['fake'], { type: 'image/jpeg' })
    mockCapturePhoto.mockImplementation(async () => {
      photo.value = jpeg
      return jpeg
    })
    const wrapper = mount(CameraCapture)
    await wrapper.find('[data-testid="camera-shutter"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="camera-preview"]').exists()).toBe(true)

    await wrapper.find('[data-testid="camera-retake"]').trigger('click')
    await nextTick()
    expect(wrapper.find('[data-testid="camera-preview"]').exists()).toBe(false)
    expect(photo.value).toBeNull()
  })

  it('emits accept with the captured blob', async () => {
    const jpeg = new Blob(['fake'], { type: 'image/jpeg' })
    mockCapturePhoto.mockImplementation(async () => {
      photo.value = jpeg
      return jpeg
    })
    const wrapper = mount(CameraCapture)
    await wrapper.find('[data-testid="camera-shutter"]').trigger('click')
    await flushPromises()
    await wrapper.find('[data-testid="camera-accept"]').trigger('click')
    const emitted = wrapper.emitted('accept')?.[0]?.[0]
    expect(emitted).toBeInstanceOf(Blob)
    expect((emitted as Blob).type).toBe('image/jpeg')
  })

  it('shows flash toggle when torch is supported', async () => {
    stream.value = createFakeStream({ torch: true })
    const wrapper = mount(CameraCapture)
    await nextTick()
    expect(wrapper.find('[data-testid="camera-flash-toggle"]').exists()).toBe(true)
  })

  it('calls toggleFacingMode when switch camera is pressed', async () => {
    const wrapper = mount(CameraCapture)
    await wrapper.find('[data-testid="camera-switch"]').trigger('click')
    expect(mockToggleFacingMode).toHaveBeenCalledTimes(1)
  })

  it('surfaces camera errors in the overlay', async () => {
    error.value = new Error('Permission denied')
    const wrapper = mount(CameraCapture)
    expect(wrapper.text()).toMatch(/permission denied/i)
  })
})
