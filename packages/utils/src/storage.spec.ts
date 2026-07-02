import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createStorage } from './storage'

describe('createStorage', () => {
  let storage: Storage

  beforeEach(() => {
    storage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      key: vi.fn(),
      length: 0,
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('gets and sets values with default prefix and JSON serialization', () => {
    const wrapper = createStorage(storage)
    wrapper.set('user', { id: '1', name: 'Test' })

    expect(storage.setItem).toHaveBeenCalledWith(
      'acme_user',
      JSON.stringify({ id: '1', name: 'Test' }),
    )

    vi.mocked(storage.getItem).mockReturnValue(JSON.stringify({ id: '1', name: 'Test' }))
    expect(wrapper.get<{ id: string; name: string }>('user')).toEqual({ id: '1', name: 'Test' })
  })

  it('returns default value when key is missing', () => {
    vi.mocked(storage.getItem).mockReturnValue(null)
    const wrapper = createStorage(storage)

    expect(wrapper.get('missing', 'fallback')).toBe('fallback')
    expect(wrapper.get('missing')).toBeNull()
  })

  it('returns default value when deserialization fails', () => {
    vi.mocked(storage.getItem).mockReturnValue('not-json')
    const wrapper = createStorage(storage)

    expect(wrapper.get('bad', 'fallback')).toBe('fallback')
  })

  it('supports custom prefix and serializers', () => {
    const wrapper = createStorage(storage, {
      prefix: 'custom_',
      serialize: (v) => String(v),
      deserialize: (v) => Number(v),
    })

    wrapper.set('count', 42)
    expect(storage.setItem).toHaveBeenCalledWith('custom_count', '42')

    vi.mocked(storage.getItem).mockReturnValue('7')
    expect(wrapper.get<number>('count')).toBe(7)
  })

  it('swallows set errors when storage is unavailable', () => {
    vi.mocked(storage.setItem).mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    const wrapper = createStorage(storage)

    expect(() => wrapper.set('key', 'value')).not.toThrow()
  })

  it('removes prefixed keys', () => {
    const wrapper = createStorage(storage)
    wrapper.remove('session')

    expect(storage.removeItem).toHaveBeenCalledWith('acme_session')
  })

  it('swallows remove errors when storage is unavailable', () => {
    vi.mocked(storage.removeItem).mockImplementation(() => {
      throw new Error('SecurityError')
    })
    const wrapper = createStorage(storage)

    expect(() => wrapper.remove('key')).not.toThrow()
  })

  it('clears only keys with the configured prefix', () => {
    const keysSpy = vi.spyOn(Object, 'keys').mockReturnValue(['acme_a', 'other_b', 'acme_c'])

    const wrapper = createStorage(storage)
    wrapper.clear()

    expect(keysSpy).toHaveBeenCalledWith(storage)
    expect(storage.removeItem).toHaveBeenCalledWith('acme_a')
    expect(storage.removeItem).toHaveBeenCalledWith('acme_c')
    expect(storage.removeItem).not.toHaveBeenCalledWith('other_b')
  })

  it('swallows clear errors when storage is unavailable', () => {
    vi.spyOn(Object, 'keys').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    const wrapper = createStorage(storage)

    expect(() => wrapper.clear()).not.toThrow()
  })

  it('reports whether a prefixed key exists', () => {
    vi.mocked(storage.getItem).mockReturnValueOnce(null).mockReturnValueOnce('{}')
    const wrapper = createStorage(storage)

    expect(wrapper.has('missing')).toBe(false)
    expect(wrapper.has('present')).toBe(true)
  })
})
