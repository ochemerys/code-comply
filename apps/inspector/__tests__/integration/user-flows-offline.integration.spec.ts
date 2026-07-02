/**
 * Frontend integration: offline deficiency, photo queue, and sync error handling (M11-S15).
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createApp } from 'vue'
import { createPinia, setActivePinia, getActivePinia } from 'pinia'
import { VueQueryPlugin } from '@tanstack/vue-query'
import { db } from '@/lib/db/dexie'
import { createSyncEngine, syncEngine } from '@/lib/db/sync-engine'
import { useDeficiencyMutation } from '@/composables/useDeficiencyMutation'
import { useNetworkStore } from '@/stores/network'
import {
  putOfflinePhoto,
  enqueuePhotoUpload,
  listOfflinePhotosForInspection,
} from '@/lib/db/photo-storage'
import { buildEmbeddedPhotoMetadata, toPhotoMetadata } from '@/lib/photo/metadata'
import type { LocalPhoto } from '@/lib/db/types'
import { apiFetch } from '@/utils/api-error-handler'

vi.mock('@/utils/api-error-handler', () => ({
  apiFetch: vi.fn(),
}))

vi.mock('@/lib/db/sync-engine', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db/sync-engine')>()
  return {
    ...actual,
    syncEngine: {
      queueMutation: vi.fn().mockResolvedValue(undefined),
      processQueue: vi.fn().mockRejectedValue(new Error('Network unavailable')),
    },
  }
})

vi.mock('@/stores/auth', () => ({
  useAuthStore: vi.fn(() => ({
    user: { id: 'user-flow-1' },
    accessToken: 'token',
  })),
}))

function mountComposable<T>(fn: () => T): T {
  let result!: T
  const app = createApp({
    setup() {
      result = fn()
      return () => {}
    },
  })
  app.use(getActivePinia()!)
  app.use(VueQueryPlugin)
  app.mount(document.createElement('div'))
  return result
}

function makePhoto(id: string, inspectionId: string): LocalPhoto {
  const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' })
  const embedded = buildEmbeddedPhotoMetadata({
    capturedAt: new Date('2026-12-01T12:00:00.000Z'),
    inspectorId: 'user-flow-1',
    inspectorName: 'Flow Tester',
    permitNumber: 'BP-FLOW-1',
  })
  return {
    id,
    clientId: `client-${id}`,
    inspectionId,
    filename: `${id}.jpg`,
    mimeType: 'image/jpeg',
    size: blob.size,
    blob,
    metadata: toPhotoMetadata(embedded, { hasWatermark: false }),
    createdAt: embedded.timestamp,
  }
}

describe('User flows — inspector offline (M11-S15)', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    await db.deficiencies.clear()
    await db.photos.clear()
    await db.syncQueue.clear()
    vi.clearAllMocks()
    useNetworkStore().isOnline = false
  })

  it('queues deficiency create while offline', async () => {
    const { createDeficiency } = mountComposable(() => useDeficiencyMutation())
    await createDeficiency.mutateAsync({
      clientId: 'flow-offline-def',
      inspectionId: 'insp-flow-1',
      description: 'Offline flow deficiency description',
      severity: 'MINOR',
      isStopWork: false,
      isUnsafe: false,
    })

    const stored = await db.deficiencies.get('offline-flow-offline-def')
    expect(stored?.isDirty).toBe(true)
    expect(syncEngine.queueMutation).toHaveBeenCalledWith(
      'deficiency.create',
      expect.objectContaining({ clientId: 'flow-offline-def' }),
      10,
    )
  })

  it('persists offline photo and enqueues upload', async () => {
    const photo = makePhoto('flow-photo-1', 'insp-flow-1')
    await putOfflinePhoto(db, photo)
    const engine = createSyncEngine({ apiClient: { processMutation: vi.fn() } } as never)
    await enqueuePhotoUpload(engine, db, photo)

    const list = await listOfflinePhotosForInspection(db, 'insp-flow-1')
    expect(list).toHaveLength(1)

    const queue = await db.syncQueue.toArray()
    expect(queue.some((q) => q.operation === 'photo.upload')).toBe(true)
  })

  it('surfaces API errors when online sync fails', async () => {
    useNetworkStore().isOnline = true
    vi.mocked(apiFetch).mockRejectedValueOnce(new Error('Server error'))

    const { createDeficiency } = mountComposable(() => useDeficiencyMutation())
    await expect(
      createDeficiency.mutateAsync({
        clientId: 'flow-online-err',
        inspectionId: 'insp-flow-2',
        description: 'Online failure scenario description',
        severity: 'MAJOR',
        isStopWork: false,
        isUnsafe: false,
      }),
    ).rejects.toThrow('Server error')
  })
})
