/**
 * @see M7-S10 - Store Photos in IndexedDB for Offline
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { defineComponent, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { useOfflinePhotos } from './useOfflinePhotos'
import * as photoStorage from '@/lib/db/photo-storage'
import type { LocalPhoto } from '@/lib/db/types'
import type { SyncEvent } from '@/lib/db/sync-engine'

function makeEngine() {
  const handlers = new Map<string, Set<(ev: SyncEvent) => void>>()
  return {
    on: vi.fn((event: string, fn: (ev: SyncEvent) => void) => {
      if (!handlers.has(event)) handlers.set(event, new Set())
      handlers.get(event)!.add(fn)
    }),
    off: vi.fn((event: string, fn: (ev: SyncEvent) => void) => {
      handlers.get(event)?.delete(fn)
    }),
    emit(event: string, data?: SyncEvent['data']) {
      const ev: SyncEvent = { type: event as SyncEvent['type'], timestamp: new Date(), data }
      handlers.get(event)?.forEach((fn) => fn(ev))
    },
    queueMutation: vi.fn().mockResolvedValue('queue-1'),
    retryFailedItems: vi.fn().mockResolvedValue(0),
  }
}

function createMockDexie() {
  return {
    photos: {
      put: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      toArray: vi.fn().mockResolvedValue([]),
      where: vi.fn().mockReturnValue({
        equals: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) }),
      }),
      count: vi.fn().mockResolvedValue(0),
    },
    syncQueue: {
      where: vi.fn().mockReturnValue({
        equals: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) }),
      }),
    },
  }
}

function mountPhotos(engine: ReturnType<typeof makeEngine>) {
  const wrapper = mount(
    defineComponent({
      setup() {
        return useOfflinePhotos({
          dexie: createMockDexie() as never,
          engine: engine as never,
        })
      },
      template: '<div />',
    }),
  )
  return {
    wrapper,
    vm: wrapper.vm as unknown as {
      uploadProgress: Record<string, number>
      queueUpload: ReturnType<typeof useOfflinePhotos>['queueUpload']
      saveAndQueueUpload: ReturnType<typeof useOfflinePhotos>['saveAndQueueUpload']
      queueDelete: ReturnType<typeof useOfflinePhotos>['queueDelete']
      removeLocalPhoto: ReturnType<typeof useOfflinePhotos>['removeLocalPhoto']
      getPhoto: ReturnType<typeof useOfflinePhotos>['getPhoto']
      listForInspection: ReturnType<typeof useOfflinePhotos>['listForInspection']
      listForDeficiency: ReturnType<typeof useOfflinePhotos>['listForDeficiency']
      getStorageStats: ReturnType<typeof useOfflinePhotos>['getStorageStats']
      retryFailedSyncItems: ReturnType<typeof useOfflinePhotos>['retryFailedSyncItems']
      uploadBlobWithProgress: ReturnType<typeof useOfflinePhotos>['uploadBlobWithProgress']
    },
  }
}

describe('useOfflinePhotos', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('queueUpload registers progress and completes on sync:item:success', async () => {
    const engine = makeEngine()
    const { vm } = mountPhotos(engine)
    await vm.queueUpload({ id: 'p1', clientId: 'c1' })
    expect(vm.uploadProgress.p1).toBe(10)
    engine.emit('sync:item:success', { itemId: 'queue-1', operation: 'photo.upload' })
    await nextTick()
    expect(vm.uploadProgress.p1).toBe(100)
  })

  it('increments progress on sync:item:retry', async () => {
    const engine = makeEngine()
    const { vm } = mountPhotos(engine)
    await vm.queueUpload({ id: 'p2', clientId: 'c2' })
    engine.emit('sync:item:retry', { itemId: 'queue-1', operation: 'photo.upload', attempt: 2 })
    await nextTick()
    expect(vm.uploadProgress.p2).toBeGreaterThan(10)
  })

  it('resets progress on terminal sync:item:error', async () => {
    const engine = makeEngine()
    const { vm } = mountPhotos(engine)
    await vm.queueUpload({ id: 'p3', clientId: 'c3' })
    engine.emit('sync:item:error', { itemId: 'queue-1', operation: 'photo.upload', attempt: 3 })
    await nextTick()
    expect(vm.uploadProgress.p3).toBe(0)
  })

  it('saveAndQueueUpload stores then queues', async () => {
    const putSpy = vi.spyOn(photoStorage, 'putOfflinePhoto').mockResolvedValue(undefined)
    const engine = makeEngine()
    const { vm } = mountPhotos(engine)
    const photo: LocalPhoto = {
      id: 'ph',
      clientId: 'cl',
      inspectionId: 'insp',
      filename: 'x.jpg',
      mimeType: 'image/jpeg',
      size: 1,
      metadata: { timestamp: '2026-04-11T00:00:00.000Z', inspectorId: 'u', hasWatermark: false },
      createdAt: '2026-04-11T00:00:00.000Z',
    }
    await vm.saveAndQueueUpload(photo)
    expect(putSpy).toHaveBeenCalledWith(expect.anything(), photo)
    expect(engine.queueMutation).toHaveBeenCalled()
  })

  it('removes sync listeners on unmount', () => {
    const engine = makeEngine()
    const { wrapper } = mountPhotos(engine)
    wrapper.unmount()
    expect(engine.off).toHaveBeenCalledWith('sync:item:success', expect.any(Function))
    expect(engine.off).toHaveBeenCalledWith('sync:item:retry', expect.any(Function))
    expect(engine.off).toHaveBeenCalledWith('sync:item:error', expect.any(Function))
  })

  it('ignores sync events that are not photo.upload or lack mapping', async () => {
    const engine = makeEngine()
    const { vm } = mountPhotos(engine)
    await vm.queueUpload({ id: 'p4', clientId: 'c4' })
    const before = { ...vm.uploadProgress }
    engine.emit('sync:item:success', { itemId: 'other-q', operation: 'photo.upload' })
    engine.emit('sync:item:success', { itemId: 'queue-1', operation: 'deficiency.create' as never })
    engine.emit('sync:item:retry', { itemId: 'queue-1', operation: 'photo.upload' })
    await nextTick()
    expect(vm.uploadProgress.p4).toBe(before.p4)
  })

  it('queueDelete, removeLocalPhoto, getPhoto, listForInspection delegate to storage', async () => {
    const delSpy = vi.spyOn(photoStorage, 'enqueuePhotoDelete').mockResolvedValue('qd-1')
    const rmSpy = vi.spyOn(photoStorage, 'deleteOfflinePhoto').mockResolvedValue(undefined)
    const getSpy = vi.spyOn(photoStorage, 'getOfflinePhoto').mockResolvedValue(undefined)
    const listSpy = vi.spyOn(photoStorage, 'listOfflinePhotosForInspection').mockResolvedValue([])
    const engine = makeEngine()
    const { vm } = mountPhotos(engine)
    await vm.queueDelete({ id: 'pd', clientId: 'cd' })
    await vm.removeLocalPhoto('pd')
    await vm.getPhoto('pd')
    await vm.listForInspection('in-1')
    expect(delSpy).toHaveBeenCalledWith(engine, expect.anything(), { id: 'pd', clientId: 'cd' })
    expect(rmSpy).toHaveBeenCalledWith(expect.anything(), 'pd')
    expect(getSpy).toHaveBeenCalledWith(expect.anything(), 'pd')
    expect(listSpy).toHaveBeenCalledWith(expect.anything(), 'in-1')
  })

  it('listForChecklistItem delegates to listOfflinePhotosForChecklistItem (M7-S16)', async () => {
    const listSpy = vi
      .spyOn(photoStorage, 'listOfflinePhotosForChecklistItem')
      .mockResolvedValue([])
    const engine = makeEngine()
    const { vm } = mountPhotos(engine)
    const extended = vm as typeof vm & {
      listForChecklistItem: (i: string, c: string) => Promise<unknown>
    }
    await extended.listForChecklistItem('in-1', 'line-1')
    expect(listSpy).toHaveBeenCalledWith(expect.anything(), 'in-1', 'line-1')
    listSpy.mockRestore()
  })

  it('listForDeficiency delegates to listOfflinePhotosForDeficiency (M7-I1)', async () => {
    const listSpy = vi.spyOn(photoStorage, 'listOfflinePhotosForDeficiency').mockResolvedValue([])
    const engine = makeEngine()
    const { vm } = mountPhotos(engine)
    await vm.listForDeficiency('def-1')
    expect(listSpy).toHaveBeenCalledWith(expect.anything(), 'def-1')
    listSpy.mockRestore()
  })

  it('getStorageStats and retryFailedSyncItems use dexie and engine', async () => {
    const sumSpy = vi.spyOn(photoStorage, 'sumStoredPhotoBytes').mockResolvedValue(42)
    const engine = makeEngine()
    const mockDexie = createMockDexie()
    mockDexie.photos.count = vi.fn().mockResolvedValue(5)
    const wrapper = mount(
      defineComponent({
        setup() {
          return useOfflinePhotos({ dexie: mockDexie as never, engine: engine as never })
        },
        template: '<div />',
      }),
    )
    const vm = wrapper.vm as unknown as {
      getStorageStats: () => Promise<{ count: number; estimatedBytes: number }>
      retryFailedSyncItems: () => Promise<number>
    }
    const stats = await vm.getStorageStats()
    expect(stats).toEqual({ count: 5, estimatedBytes: 42 })
    expect(sumSpy).toHaveBeenCalledWith(mockDexie)
    await vm.retryFailedSyncItems()
    expect(engine.retryFailedItems).toHaveBeenCalled()
    wrapper.unmount()
  })

  it('exposes uploadBlobWithProgress from photo-storage', () => {
    const engine = makeEngine()
    const { vm } = mountPhotos(engine)
    expect(vm.uploadBlobWithProgress).toBe(photoStorage.uploadBlobWithProgress)
  })
})
