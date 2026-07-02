import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  isQuotaExceededError,
  isIndexedDbInvalidStateError,
  OfflineStorageQuotaError,
  runWithIndexedDbQuotaRetry,
} from './reclaim-storage'
import { db } from './dexie'

vi.mock('./dexie', () => {
  const permits = { clear: vi.fn().mockResolvedValue(undefined) }
  const checklistTemplateCache = { clear: vi.fn().mockResolvedValue(undefined) }
  const photos = {
    toCollection: vi.fn(() => ({
      modify: vi.fn().mockResolvedValue(0),
    })),
  }
  return {
    db: {
      permits,
      checklistTemplateCache,
      photos,
      transaction: vi.fn(async (...args: unknown[]) => {
        const scope = args[args.length - 1]
        if (typeof scope === 'function') await (scope as () => Promise<void>)()
      }),
    },
  }
})

describe('reclaim-storage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('isQuotaExceededError', () => {
    it('returns true for DOMException QuotaExceededError', () => {
      expect(isQuotaExceededError(new DOMException('q', 'QuotaExceededError'))).toBe(true)
    })

    it('returns false for other errors', () => {
      expect(isQuotaExceededError(new Error('nope'))).toBe(false)
      expect(isQuotaExceededError(new DOMException('x', 'InvalidStateError'))).toBe(false)
    })
  })

  describe('isIndexedDbInvalidStateError', () => {
    it('returns true for InvalidStateError', () => {
      expect(isIndexedDbInvalidStateError(new DOMException('x', 'InvalidStateError'))).toBe(true)
    })
  })

  describe('runWithIndexedDbQuotaRetry', () => {
    it('retries after reclaim on quota', async () => {
      const qe = new DOMException('q', 'QuotaExceededError')
      let n = 0
      const op = vi.fn(async () => {
        n += 1
        if (n === 1) throw qe
        return 42
      })

      await expect(runWithIndexedDbQuotaRetry(op)).resolves.toBe(42)
      expect(op).toHaveBeenCalledTimes(2)
      expect(db.transaction).toHaveBeenCalled()
      expect(db.permits.clear).toHaveBeenCalled()
    })

    it('throws OfflineStorageQuotaError when retry still fails', async () => {
      const qe = new DOMException('q', 'QuotaExceededError')
      const op = vi.fn(async () => {
        throw qe
      })

      await expect(runWithIndexedDbQuotaRetry(op)).rejects.toBeInstanceOf(OfflineStorageQuotaError)
      expect(op).toHaveBeenCalledTimes(2)
    })
  })
})
