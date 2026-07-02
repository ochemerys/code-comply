/**
 * Storage utilities for working with localStorage and sessionStorage
 */

export interface StorageOptions {
  prefix?: string
  serialize?: (value: unknown) => string
  deserialize?: (value: string) => unknown
}

const defaultOptions: StorageOptions = {
  prefix: 'acme_',
  serialize: JSON.stringify,
  deserialize: JSON.parse,
}

/**
 * Create a storage wrapper with optional prefix and serialization
 */
export function createStorage(storage: Storage, options: StorageOptions = {}) {
  const opts = { ...defaultOptions, ...options }

  return {
    get<T>(key: string, defaultValue?: T): T | null {
      try {
        const item = storage.getItem(opts.prefix + key)
        if (item === null) {
          return defaultValue ?? null
        }
        return opts.deserialize!(item) as T
      } catch {
        return defaultValue ?? null
      }
    },

    set(key: string, value: unknown): void {
      try {
        storage.setItem(opts.prefix + key, opts.serialize!(value))
      } catch {
        // Storage may be full or unavailable
      }
    },

    remove(key: string): void {
      try {
        storage.removeItem(opts.prefix + key)
      } catch {
        // Storage may be unavailable
      }
    },

    clear(): void {
      try {
        const keys = Object.keys(storage)
        keys.forEach((key) => {
          if (key.startsWith(opts.prefix!)) {
            storage.removeItem(key)
          }
        })
      } catch {
        // Storage may be unavailable
      }
    },

    has(key: string): boolean {
      return storage.getItem(opts.prefix + key) !== null
    },
  }
}
