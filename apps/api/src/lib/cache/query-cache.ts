/**
 * Query-result cache for hot read paths (M11-S11).
 * Uses in-memory store by default; connects to Redis when REDIS_URL is set.
 */

import { Redis } from 'ioredis'

export interface CacheStore {
  get(key: string): Promise<string | null>
  set(key: string, value: string, ttlSeconds: number): Promise<void>
  delete(key: string): Promise<void>
  deleteByPrefix(prefix: string): Promise<void>
}

type MemoryEntry = { value: string; expiresAt: number }

export class MemoryCacheStore implements CacheStore {
  private readonly entries = new Map<string, MemoryEntry>()

  async get(key: string): Promise<string | null> {
    const row = this.entries.get(key)
    if (!row) return null
    if (Date.now() > row.expiresAt) {
      this.entries.delete(key)
      return null
    }
    return row.value
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    this.entries.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 })
  }

  async delete(key: string): Promise<void> {
    this.entries.delete(key)
  }

  async deleteByPrefix(prefix: string): Promise<void> {
    for (const key of [...this.entries.keys()]) {
      if (key.startsWith(prefix)) {
        this.entries.delete(key)
      }
    }
  }

  clear(): void {
    this.entries.clear()
  }
}

type RedisClientLike = {
  get(key: string): Promise<string | null>
  set(key: string, value: string, mode: 'EX', ttl: number): Promise<unknown>
  del(...keys: string[]): Promise<number>
  keys(pattern: string): Promise<string[]>
}

export class RedisCacheStore implements CacheStore {
  constructor(private readonly client: RedisClientLike) {}

  async get(key: string): Promise<string | null> {
    return this.client.get(key)
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    await this.client.set(key, value, 'EX', ttlSeconds)
  }

  async delete(key: string): Promise<void> {
    await this.client.del(key)
  }

  async deleteByPrefix(prefix: string): Promise<void> {
    const keys = await this.client.keys(`${prefix}*`)
    if (keys.length > 0) {
      await this.client.del(...keys)
    }
  }
}

let defaultStore: CacheStore = new MemoryCacheStore()

export function getQueryCacheStore(): CacheStore {
  return defaultStore
}

export function setQueryCacheStore(store: CacheStore): void {
  defaultStore = store
}

export function resetQueryCacheStore(): void {
  if (defaultStore instanceof MemoryCacheStore) {
    defaultStore.clear()
  }
  defaultStore = new MemoryCacheStore()
}

/** Lazily connect Redis when REDIS_URL is present (production). */
export async function initQueryCacheFromEnv(): Promise<void> {
  const url = process.env.REDIS_URL?.trim()
  if (!url) return

  try {
    const client = new Redis(url, { maxRetriesPerRequest: 1, lazyConnect: true })
    await client.connect()
    defaultStore = new RedisCacheStore(client)
  } catch (err) {
    console.warn('[query-cache] Redis unavailable, using in-memory store:', err)
  }
}

export async function getCached<T>(
  key: string,
  ttlSeconds: number,
  loader: () => Promise<T>,
): Promise<T> {
  const store = getQueryCacheStore()
  const cached = await store.get(key)
  if (cached !== null) {
    return JSON.parse(cached) as T
  }

  const value = await loader()
  await store.set(key, JSON.stringify(value), ttlSeconds)
  return value
}

export async function invalidateCacheKey(key: string): Promise<void> {
  await getQueryCacheStore().delete(key)
}

export async function invalidateCacheByPrefix(prefix: string): Promise<void> {
  await getQueryCacheStore().deleteByPrefix(prefix)
}
