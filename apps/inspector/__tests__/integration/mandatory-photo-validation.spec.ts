/**
 * Integration — mandatory photo validation + checklist-scoped gallery (M7-S16).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import PhotoGallery from '@/components/PhotoGallery.vue'
import { db } from '@/lib/db/dexie'
import { putOfflinePhoto } from '@/lib/db/photo-storage'
import type { LocalPhoto } from '@/lib/db/types'
import { buildEmbeddedPhotoMetadata, toPhotoMetadata } from '@/lib/photo/metadata'
import { useAuthStore } from '@/stores/auth'

const mockPush = vi.fn()

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return {
    ...actual,
    useRouter: () => ({
      push: mockPush,
      hasRoute: (n: string) => n === 'checklist-execution' || n === 'home',
    }),
    useRoute: () => ({ name: 'checklist-execution' }),
  }
})

vi.mock('@/lib/db/sync-engine', () => ({
  syncEngine: {
    on: vi.fn(),
    off: vi.fn(),
    queueMutation: vi.fn().mockResolvedValue('q1'),
    getStatusAsync: vi.fn(),
    getTotalQueueSize: vi.fn(),
    sync: vi.fn(),
    retryFailedItems: vi.fn(),
    clearFailedItems: vi.fn(),
  },
}))

function makePhoto(
  id: string,
  inspectionId: string,
  checklistItemId: string | undefined,
): LocalPhoto {
  const embedded = buildEmbeddedPhotoMetadata({
    capturedAt: new Date('2026-04-12T10:00:00.000Z'),
    inspectorId: 'int-user',
    inspectorName: 'Integration',
  })
  return {
    id,
    clientId: `client-${id}`,
    inspectionId,
    checklistItemId,
    filename: `${id}.jpg`,
    mimeType: 'image/jpeg',
    size: 12,
    thumbnail: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=',
    metadata: toPhotoMetadata(embedded, { hasWatermark: false }),
    createdAt: embedded.timestamp,
  }
}

describe('Mandatory checklist photos (M7-S16)', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    const auth = useAuthStore()
    auth.user = {
      id: 'int-user',
      email: 'i@n.t',
      name: 'Integration',
      role: 'SCO',
      certifications: [],
      disciplines: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    await db.photos.clear()
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('PhotoGallery lists only photos for the checklist item id from IndexedDB', async () => {
    const inspectionId = 'insp-m7s16-int'
    await putOfflinePhoto(db, makePhoto('p-a', inspectionId, 'line-a'))
    await putOfflinePhoto(db, makePhoto('p-b', inspectionId, 'line-b'))

    const w = mount(PhotoGallery, {
      props: { inspectionId, checklistItemId: 'line-a', captureReturnRoute: 'checklist-execution' },
      attachTo: document.body,
    })
    await flushPromises()
    await vi.waitUntil(() => w.find('[data-testid="photo-gallery-grid"]').exists(), {
      timeout: 3000,
    })
    expect(w.findAll('[data-testid="photo-thumbnail"]')).toHaveLength(1)
  })

  it('Add from gallery navigates to capture-photo with checklist return route', async () => {
    const w = mount(PhotoGallery, {
      props: {
        inspectionId: 'insp-m7s16-int',
        checklistItemId: 'line-a',
        captureReturnRoute: 'checklist-execution',
        captureReturnRouteQuery: {
          inspectionId: 'insp-m7s16-int',
          executionId: 'exec-m7s16',
        },
      },
      attachTo: document.body,
    })
    await flushPromises()
    await w.find('[data-testid="photo-gallery-add"]').trigger('click')
    expect(mockPush).toHaveBeenCalledWith({
      name: 'capture-photo',
      query: {
        return: 'checklist-execution',
        inspectionId: 'insp-m7s16-int',
        executionId: 'exec-m7s16',
        checklistItemId: 'line-a',
      },
    })
  })
})
