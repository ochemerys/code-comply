/**
 * M7-S11: Multiple checklist-line galleries mount together; the blob from "Use Photo"
 * must be ingested only by the gallery that opened capture (scoped by checklistItemId).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, ref, nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import PhotoGallery from '@/components/PhotoGallery.vue'
import { useAuthStore } from '@/stores/auth'
import { clearPendingAcceptedPhoto, setLastAcceptedPhoto } from '@/lib/photo/last-capture'

const mockSaveAndQueueUpload = vi.fn()

vi.mock('@/composables/useOfflinePhotos', () => ({
  useOfflinePhotos: () => ({
    uploadProgress: ref({}),
    savePhoto: vi.fn(),
    queueUpload: vi.fn(),
    saveAndQueueUpload: mockSaveAndQueueUpload,
    queueDelete: vi.fn(),
    removeLocalPhoto: vi.fn(),
    getPhoto: vi.fn(),
    listForInspection: vi.fn(),
    listForChecklistItem: vi.fn().mockResolvedValue([]),
    listForDeficiency: vi.fn().mockResolvedValue([]),
    getStorageStats: vi.fn(),
    retryFailedSyncItems: vi.fn(),
    uploadBlobWithProgress: vi.fn(),
  }),
}))

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return {
    ...actual,
    useRouter: () => ({
      push: vi.fn(),
      hasRoute: () => true,
    }),
    useRoute: () => ({ name: 'checklist-execution' }),
  }
})

vi.mock('@/lib/db/dexie', () => ({
  db: {
    inspections: {
      get: vi.fn(async () => ({ permitNumber: 'BP-TEST' })),
    },
  },
}))

vi.mock('@/lib/photo/compression', () => ({
  compressInspectionPhoto: vi.fn(
    async (blob: Blob) => new File([blob], 'capture.jpg', { type: 'image/jpeg' }),
  ),
}))

vi.mock('@/lib/db/sync-engine', () => ({
  syncEngine: {
    on: vi.fn(),
    off: vi.fn(),
    queueMutation: vi.fn(),
    getStatusAsync: vi.fn(),
    getTotalQueueSize: vi.fn(),
    sync: vi.fn(),
    retryFailedItems: vi.fn(),
    clearFailedItems: vi.fn(),
  },
}))

describe('PhotoGallery scoped capture ingest (M7-S11)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearPendingAcceptedPhoto()
    setActivePinia(createPinia())
    const auth = useAuthStore()
    auth.user = {
      id: 'u-ingest',
      email: 'a@b.c',
      name: 'Inspector',
      role: 'SCO',
      certifications: [],
      disciplines: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    mockSaveAndQueueUpload.mockResolvedValue('queued')
    vi.stubGlobal(
      'Image',
      class FakeImage {
        onload: (() => void) | null = null
        onerror: (() => void) | null = null
        naturalWidth = 8
        naturalHeight = 8
        set src(_v: string) {
          queueMicrotask(() => this.onload?.())
        }
      } as unknown as typeof Image,
    )
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      () =>
        ({
          drawImage: vi.fn(),
        }) as unknown as CanvasRenderingContext2D,
    )
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/jpeg;base64,xx')
  })

  afterEach(() => {
    clearPendingAcceptedPhoto()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  it('only the matching checklist line gallery saves after Use Photo (mount order line-a before line-b)', async () => {
    const jpeg = new Blob(['evidence'], { type: 'image/jpeg' })
    setLastAcceptedPhoto(jpeg, { checklistItemId: 'line-b' })

    const Parent = defineComponent({
      components: { PhotoGallery },
      template: `
        <div>
          <PhotoGallery
            inspection-id="insp-x"
            checklist-item-id="line-a"
            capture-return-route="checklist-execution"
          />
          <PhotoGallery
            inspection-id="insp-x"
            checklist-item-id="line-b"
            capture-return-route="checklist-execution"
          />
        </div>
      `,
    })

    mount(Parent, { attachTo: document.body })
    await flushPromises()
    await nextTick()

    expect(mockSaveAndQueueUpload).toHaveBeenCalledTimes(1)
    expect(mockSaveAndQueueUpload.mock.calls[0]![0]).toMatchObject({
      inspectionId: 'insp-x',
      checklistItemId: 'line-b',
    })
  })
})
