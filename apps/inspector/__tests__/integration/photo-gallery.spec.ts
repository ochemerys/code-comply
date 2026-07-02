/**
 * Integration — PhotoGallery lists offline photos from IndexedDB (M7-S13).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
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
      hasRoute: (n: string) => typeof n === 'string' && n.length > 0,
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

function makeLocalPhoto(id: string, inspectionId: string): LocalPhoto {
  const embedded = buildEmbeddedPhotoMetadata({
    capturedAt: new Date('2026-04-12T10:00:00.000Z'),
    inspectorId: 'int-user',
    inspectorName: 'Integration',
    permitNumber: 'BP-INT',
  })
  return {
    id,
    clientId: `client-${id}`,
    inspectionId,
    filename: `${id}.jpg`,
    mimeType: 'image/jpeg',
    size: 12,
    thumbnail: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=',
    metadata: toPhotoMetadata(embedded, { hasWatermark: false }),
    createdAt: embedded.timestamp,
  }
}

describe('PhotoGallery integration (M7-S13)', () => {
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

  it('loads photos for inspection from IndexedDB', async () => {
    const inspectionId = 'insp-gallery-int'
    await putOfflinePhoto(db, makeLocalPhoto('g1', inspectionId))
    await putOfflinePhoto(db, makeLocalPhoto('g2', inspectionId))
    expect(await db.photos.count()).toBe(2)
    const byInsp = await db.photos.where('inspectionId').equals(inspectionId).toArray()
    expect(byInsp).toHaveLength(2)

    const w = mount(PhotoGallery, {
      props: { inspectionId },
      attachTo: document.body,
    })
    await flushPromises()
    await vi.waitUntil(() => w.find('[data-testid="photo-gallery-grid"]').exists(), {
      timeout: 3000,
    })
    expect(w.findAll('[data-testid="photo-thumbnail"]')).toHaveLength(2)
    expect(w.find('[data-testid="photo-gallery-count"]').text()).toContain('(2)')
    w.unmount()
  })

  it('Add opens capture route with return query', async () => {
    const inspectionId = 'insp-gallery-int'
    const w = mount(PhotoGallery, {
      props: { inspectionId, captureReturnRoute: 'checklist-execution' },
      attachTo: document.body,
    })
    await flushPromises()
    await vi.waitUntil(() => w.find('[data-testid="photo-gallery-empty"]').exists(), {
      timeout: 3000,
    })
    await w.find('[data-testid="photo-gallery-add"]').trigger('click')
    expect(mockPush).toHaveBeenCalledWith({
      name: 'capture-photo',
      query: { return: 'checklist-execution' },
    })
    w.unmount()
  })

  it('full view and delete remove row from IndexedDB', async () => {
    const inspectionId = 'insp-gallery-del'
    await putOfflinePhoto(db, makeLocalPhoto('del1', inspectionId))

    const w = mount(PhotoGallery, {
      props: { inspectionId },
      attachTo: document.body,
      global: {
        stubs: {
          Teleport: { template: '<div><slot /></div>' },
        },
      },
    })
    await flushPromises()
    await vi.waitUntil(() => w.find('[data-testid="photo-gallery-grid"]').exists(), {
      timeout: 3000,
    })
    await w.find('[data-testid="photo-thumbnail"]').trigger('click')
    await nextTick()
    await w.find('[data-testid="photo-gallery-delete"]').trigger('click')
    await nextTick()
    await w.find('[data-testid="photo-gallery-delete-confirm-btn"]').trigger('click')
    await flushPromises()
    await vi.waitUntil(
      async () => (await db.photos.where('inspectionId').equals(inspectionId).count()) === 0,
      {
        timeout: 3000,
      },
    )
    w.unmount()
  })
})
