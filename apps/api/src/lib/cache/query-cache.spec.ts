import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  MemoryCacheStore,
  RedisCacheStore,
  getCached,
  getQueryCacheStore,
  resetQueryCacheStore,
  setQueryCacheStore,
} from './query-cache.js'

describe('query-cache (M11-S11)', () => {
  beforeEach(() => {
    resetQueryCacheStore()
  })

  describe('MemoryCacheStore', () => {
    it('stores and retrieves values within TTL', async () => {
      const store = new MemoryCacheStore()
      await store.set('key', '{"a":1}', 60)
      expect(await store.get('key')).toBe('{"a":1}')
    })

    it('expires entries after TTL', async () => {
      vi.useFakeTimers()
      const store = new MemoryCacheStore()
      await store.set('key', 'value', 1)
      vi.advanceTimersByTime(1500)
      expect(await store.get('key')).toBeNull()
      vi.useRealTimers()
    })

    it('deletes by prefix', async () => {
      const store = new MemoryCacheStore()
      await store.set('code-library:type:nbc', '[]', 60)
      await store.set('code-library:section:nbc:1', '{}', 60)
      await store.set('other', 'x', 60)
      await store.deleteByPrefix('code-library:')
      expect(await store.get('code-library:type:nbc')).toBeNull()
      expect(await store.get('other')).toBe('x')
    })
  })

  describe('getCached', () => {
    it('loads once and returns cached value on subsequent calls', async () => {
      const loader = vi.fn().mockResolvedValue({ id: '1' })
      const first = await getCached('test-key', 60, loader)
      const second = await getCached('test-key', 60, loader)

      expect(first).toEqual({ id: '1' })
      expect(second).toEqual({ id: '1' })
      expect(loader).toHaveBeenCalledTimes(1)
    })

    it('uses configured store', async () => {
      const store = new MemoryCacheStore()
      setQueryCacheStore(store)
      await getCached('k', 60, async () => [1, 2])
      expect(await store.get('k')).toContain('[1,2]')
      expect(getQueryCacheStore()).toBe(store)
    })
  })

  describe('RedisCacheStore', () => {
    it('delegates to redis client', async () => {
      const client = {
        get: vi.fn().mockResolvedValue('cached'),
        set: vi.fn().mockResolvedValue('OK'),
        del: vi.fn().mockResolvedValue(1),
        keys: vi.fn().mockResolvedValue(['a', 'b']),
      }
      const store = new RedisCacheStore(client)

      expect(await store.get('k')).toBe('cached')
      await store.set('k', 'v', 30)
      await store.delete('k')
      await store.deleteByPrefix('prefix:')

      expect(client.set).toHaveBeenCalledWith('k', 'v', 'EX', 30)
      expect(client.del).toHaveBeenCalledWith('a', 'b')
    })
  })
})
