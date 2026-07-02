import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref, nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import PhotoGallery from './PhotoGallery.vue'
import type { LocalPhoto } from '@/lib/db/types'
import { useAuthStore } from '@/stores/auth'

const { mockConsume } = vi.hoisted(() => ({
  mockConsume: vi.fn(),
}))

const mockPush = vi.fn()
const mockListForInspection = vi.fn()
const mockListForChecklistItem = vi.fn()
const mockListForDeficiency = vi.fn()
const mockSavePhoto = vi.fn()
const mockSaveAndQueueUpload = vi.fn()
const mockQueueDelete = vi.fn()
const mockRemoveLocalPhoto = vi.fn()

vi.mock('@/composables/useOfflinePhotos', () => ({
  useOfflinePhotos: () => ({
    uploadProgress: ref({}),
    savePhoto: mockSavePhoto,
    queueUpload: vi.fn(),
    saveAndQueueUpload: mockSaveAndQueueUpload,
    queueDelete: mockQueueDelete,
    removeLocalPhoto: mockRemoveLocalPhoto,
    getPhoto: vi.fn(),
    listForInspection: mockListForInspection,
    listForChecklistItem: mockListForChecklistItem,
    listForDeficiency: mockListForDeficiency,
    getStorageStats: vi.fn(),
    retryFailedSyncItems: vi.fn(),
    uploadBlobWithProgress: vi.fn(),
  }),
}))

const routeName = ref('deficiency-detail')
vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return {
    ...actual,
    useRouter: () => ({
      push: mockPush,
      hasRoute: (n: string) =>
        n === 'deficiency-detail' || n === 'home' || n === 'checklist-execution',
    }),
    useRoute: () => ({ name: routeName.value }),
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

vi.mock('@/lib/photo/last-capture', () => ({
  consumeLastAcceptedPhoto: (scope?: unknown) => mockConsume(scope),
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

function tinyPhoto(overrides?: Partial<LocalPhoto>): LocalPhoto {
  const now = new Date().toISOString()
  return {
    id: 'p1',
    clientId: 'c1',
    inspectionId: 'insp-1',
    filename: 'a.jpg',
    mimeType: 'image/jpeg',
    size: 100,
    thumbnail: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=',
    metadata: {
      timestamp: now,
      inspectorId: 'u1',
      hasWatermark: false,
    },
    createdAt: now,
    ...overrides,
  }
}

describe('PhotoGallery (M7-S13)', () => {
  let getContextSpy: ReturnType<typeof vi.spyOn>
  let toDataUrlSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
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
    vi.clearAllMocks()
    getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      () =>
        ({
          drawImage: vi.fn(),
        }) as unknown as CanvasRenderingContext2D,
    )
    toDataUrlSpy = vi
      .spyOn(HTMLCanvasElement.prototype, 'toDataURL')
      .mockReturnValue('data:image/jpeg;base64,xx')
    setActivePinia(createPinia())
    const auth = useAuthStore()
    auth.user = {
      id: 'u1',
      email: 'a@b.c',
      name: 'Inspector',
      role: 'SCO',
      certifications: [],
      disciplines: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    mockListForInspection.mockResolvedValue([tinyPhoto()])
    mockListForChecklistItem.mockResolvedValue([tinyPhoto()])
    mockListForDeficiency.mockResolvedValue([tinyPhoto({ deficiencyId: 'd1' })])
    mockSavePhoto.mockResolvedValue(undefined)
    mockSaveAndQueueUpload.mockResolvedValue('queued')
    mockQueueDelete.mockResolvedValue('qd')
    mockRemoveLocalPhoto.mockResolvedValue(undefined)
    mockConsume.mockReturnValue(null)
    routeName.value = 'deficiency-detail'
  })

  afterEach(() => {
    getContextSpy?.mockRestore()
    toDataUrlSpy?.mockRestore()
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
  })

  it('renders thumbnails from listForInspection', async () => {
    const w = mount(PhotoGallery, {
      props: { inspectionId: 'insp-1' },
      attachTo: document.body,
    })
    await flushPromises()
    expect(mockListForInspection).toHaveBeenCalledWith('insp-1')
    expect(mockListForChecklistItem).not.toHaveBeenCalled()
    expect(w.findAll('[data-testid="photo-thumbnail"]')).toHaveLength(1)
    expect(w.find('[data-testid="photo-gallery-count"]').text()).toContain('(1)')
  })

  it('scopes listing to deficiency when deficiencyId is set (M7-I1)', async () => {
    mockListForDeficiency.mockResolvedValueOnce([
      tinyPhoto({ id: 'p-def', deficiencyId: 'def-99' }),
    ])
    const w = mount(PhotoGallery, {
      props: { inspectionId: 'insp-1', deficiencyId: 'def-99' },
      attachTo: document.body,
    })
    await flushPromises()
    expect(mockListForDeficiency).toHaveBeenCalledWith('def-99')
    expect(mockListForInspection).not.toHaveBeenCalled()
    expect(mockListForChecklistItem).not.toHaveBeenCalled()
    expect(w.findAll('[data-testid="photo-thumbnail"]')).toHaveLength(1)
    w.unmount()
  })

  it('scopes listing to checklist item when checklistItemId is set (M7-S16)', async () => {
    mockListForChecklistItem.mockResolvedValueOnce([
      tinyPhoto({ id: 'p-line', clientId: 'c-line' }),
    ])
    const w = mount(PhotoGallery, {
      props: { inspectionId: 'insp-1', checklistItemId: 'line-99' },
      attachTo: document.body,
    })
    await flushPromises()
    expect(mockListForChecklistItem).toHaveBeenCalledWith('insp-1', 'line-99')
    expect(mockListForInspection).not.toHaveBeenCalled()
    expect(w.findAll('[data-testid="photo-thumbnail"]')).toHaveLength(1)
  })

  it('shows empty state when there are no photos', async () => {
    mockListForInspection.mockResolvedValue([])
    const w = mount(PhotoGallery, {
      props: { inspectionId: 'insp-1' },
      attachTo: document.body,
    })
    await flushPromises()
    expect(w.find('[data-testid="photo-gallery-empty"]').exists()).toBe(true)
  })

  it('opens full view when a thumbnail is clicked', async () => {
    const w = mount(PhotoGallery, {
      props: { inspectionId: 'insp-1' },
      attachTo: document.body,
    })
    await flushPromises()
    await w.find('[data-testid="photo-thumbnail"]').trigger('click')
    await nextTick()
    expect(document.querySelector('[data-testid="photo-gallery-full-view"]')).toBeTruthy()
  })

  it('closes full view from Close button', async () => {
    const w = mount(PhotoGallery, {
      props: { inspectionId: 'insp-1' },
      attachTo: document.body,
    })
    await flushPromises()
    await w.find('[data-testid="photo-thumbnail"]').trigger('click')
    await nextTick()
    document
      .querySelector('[data-testid="photo-gallery-close-full"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()
    expect(document.querySelector('[data-testid="photo-gallery-full-view"]')).toBeFalsy()
    w.unmount()
  })

  it('Add navigates to capture-photo with return route', async () => {
    const w = mount(PhotoGallery, {
      props: { inspectionId: 'insp-1', captureReturnRoute: 'deficiency-detail' },
      attachTo: document.body,
    })
    await flushPromises()
    await w.find('[data-testid="photo-gallery-add"]').trigger('click')
    expect(mockPush).toHaveBeenCalledWith({
      name: 'capture-photo',
      query: { return: 'deficiency-detail' },
    })
    w.unmount()
  })

  it('Add merges deficiencyId into capture-photo query (M7-I1)', async () => {
    const w = mount(PhotoGallery, {
      props: {
        inspectionId: 'insp-7',
        deficiencyId: 'def-7',
        captureReturnRoute: 'deficiency-detail',
        captureReturnRouteQuery: { inspectionId: 'insp-7', deficiencyId: 'def-7' },
      },
      attachTo: document.body,
    })
    await flushPromises()
    await w.find('[data-testid="photo-gallery-add"]').trigger('click')
    expect(mockPush).toHaveBeenCalledWith({
      name: 'capture-photo',
      query: {
        return: 'deficiency-detail',
        inspectionId: 'insp-7',
        deficiencyId: 'def-7',
      },
    })
    w.unmount()
  })

  it('Add merges captureReturnRouteQuery into capture-photo query (M7-S11-B1)', async () => {
    const w = mount(PhotoGallery, {
      props: {
        inspectionId: 'insp-1',
        checklistItemId: 'line-77',
        captureReturnRoute: 'checklist-execution',
        captureReturnRouteQuery: { inspectionId: 'insp-1', executionId: 'exec-9' },
      },
      attachTo: document.body,
    })
    await flushPromises()
    await w.find('[data-testid="photo-gallery-add"]').trigger('click')
    expect(mockPush).toHaveBeenCalledWith({
      name: 'capture-photo',
      query: {
        return: 'checklist-execution',
        inspectionId: 'insp-1',
        executionId: 'exec-9',
        checklistItemId: 'line-77',
      },
    })
  })

  it('delete flow queues delete and removes local row', async () => {
    const w = mount(PhotoGallery, {
      props: { inspectionId: 'insp-1' },
      attachTo: document.body,
    })
    await flushPromises()
    await w.find('[data-testid="photo-thumbnail"]').trigger('click')
    await nextTick()
    document
      .querySelector('[data-testid="photo-gallery-delete"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()
    document
      .querySelector('[data-testid="photo-gallery-delete-confirm-btn"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()
    expect(mockQueueDelete).toHaveBeenCalledWith({ id: 'p1', clientId: 'c1' })
    expect(mockRemoveLocalPhoto).toHaveBeenCalledWith('p1')
    w.unmount()
  })

  it('ingests last accepted photo on mount', async () => {
    mockConsume.mockReturnValueOnce(new Blob(['x'], { type: 'image/jpeg' }))
    mockListForInspection.mockResolvedValue([])

    mount(PhotoGallery, {
      props: { inspectionId: 'insp-1' },
      attachTo: document.body,
    })
    await flushPromises()
    expect(mockConsume).toHaveBeenCalled()
    expect(mockSaveAndQueueUpload).toHaveBeenCalled()
  })

  it('renders thumbnail from blob when no embedded thumbnail (offline)', async () => {
    const blob = new Blob(['jpeg'], { type: 'image/jpeg' })
    mockListForInspection.mockResolvedValue([
      tinyPhoto({
        id: 'blob-only',
        thumbnail: undefined,
        blob,
      }),
    ])
    const w = mount(PhotoGallery, {
      props: { inspectionId: 'insp-1' },
      attachTo: document.body,
    })
    await flushPromises()
    const img = w.find('[data-testid="photo-thumbnail"] img')
    expect(img.attributes('src')).toMatch(/^blob:/)
  })
})
