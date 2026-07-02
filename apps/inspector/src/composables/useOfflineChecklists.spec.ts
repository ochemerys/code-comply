/**
 * Unit tests — useOfflineChecklists (M5-S15)
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { InspectorDB } from '@/lib/db/dexie'
import type { ChecklistTemplateDTO } from '@codecomply/validators'
import {
  useOfflineChecklists,
  CHECKLIST_TEMPLATE_CACHE_TTL_MS,
  CHECKLIST_TEMPLATE_CACHE_MAX,
} from './useOfflineChecklists'

function makeTemplate(
  id: string,
  versionHash: string,
  items: ChecklistTemplateDTO['items'] = [
    {
      id: 'i1',
      order: 1,
      text: 'Q1',
      isRequired: true,
      requiresPhoto: false,
    },
  ],
): ChecklistTemplateDTO {
  const now = new Date().toISOString()
  return {
    id,
    name: `Template ${id}`,
    discipline: 'Building',
    version: 1,
    versionHash,
    items,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  }
}

describe('useOfflineChecklists', () => {
  let testDb: InspectorDB

  beforeEach(async () => {
    const name = `OfflineCl-${Math.random().toString(36).slice(2)}`
    testDb = new InspectorDB(name)
    await testDb.open()
  })

  afterEach(async () => {
    if (testDb.isOpen()) testDb.close()
    await testDb.delete()
  })

  it('caches template on put and returns it from getCachedTemplate', async () => {
    const { putTemplate, getCachedTemplate } = useOfflineChecklists({ database: testDb })
    const t = makeTemplate('tpl-a', 'hash-1')
    await putTemplate(t)
    const got = await getCachedTemplate('tpl-a', 'hash-1')
    expect(got).not.toBeNull()
    expect(got!.id).toBe('tpl-a')
    expect(got!.versionHash).toBe('hash-1')
    expect(got!.items).toHaveLength(1)
    expect(got!.items[0]!.text).toBe('Q1')
  })

  it('resolveTemplate uses cache when fetchLive is not used', async () => {
    const { putTemplate, resolveTemplate } = useOfflineChecklists({ database: testDb })
    await putTemplate(makeTemplate('tpl-b', 'hv1'))
    const r = await resolveTemplate({
      templateId: 'tpl-b',
      expectedVersionHash: 'hv1',
    })
    expect(r.id).toBe('tpl-b')
  })

  it('resolveTemplate throws when cache misses and offline', async () => {
    const { resolveTemplate } = useOfflineChecklists({ database: testDb })
    await expect(
      resolveTemplate({
        templateId: 'tpl-missing',
        expectedVersionHash: 'hv-missing',
      }),
    ).rejects.toThrow(/not cached/)
  })

  it('resolveTemplate calls fetchLive when cache misses and online path supplies fetcher', async () => {
    const { resolveTemplate, getCachedTemplate } = useOfflineChecklists({ database: testDb })
    let called = false
    const r = await resolveTemplate({
      templateId: 'tpl-c',
      expectedVersionHash: 'hv2',
      fetchLive: async () => {
        called = true
        return makeTemplate('tpl-c', 'hv2', [
          { id: 'x', order: 1, text: 'From fetch', isRequired: true, requiresPhoto: false },
        ])
      },
    })
    expect(called).toBe(true)
    expect(r.items[0]!.text).toBe('From fetch')
    const cached = await getCachedTemplate('tpl-c', 'hv2')
    expect(cached?.items[0]!.text).toBe('From fetch')
  })

  it('resolveTemplate rejects when fetch returns mismatched hash', async () => {
    const { resolveTemplate } = useOfflineChecklists({ database: testDb })
    await expect(
      resolveTemplate({
        templateId: 'tpl-d',
        expectedVersionHash: 'want-this',
        fetchLive: async () => makeTemplate('tpl-d', 'wrong-hash'),
      }),
    ).rejects.toThrow(/mismatch/)
  })

  it('drops expired entries on read', async () => {
    const { getCachedTemplate } = useOfflineChecklists({ database: testDb })
    const old = new Date(Date.now() - CHECKLIST_TEMPLATE_CACHE_TTL_MS - 60_000).toISOString()
    await testDb.checklistTemplateCache.put({
      templateId: 'tpl-e',
      versionHash: 'hexp',
      name: 'Old',
      discipline: 'X',
      version: 1,
      items: [{ id: 'i1', order: 1, text: 'old', isRequired: true, requiresPhoto: false }],
      cachedAt: old,
    })
    const got = await getCachedTemplate('tpl-e', 'hexp')
    expect(got).toBeNull()
    const row = await testDb.checklistTemplateCache.get(['tpl-e', 'hexp'])
    expect(row).toBeUndefined()
  })

  it('enforces max template count via LRU by cachedAt', async () => {
    const { putTemplate, pruneTemplateCache } = useOfflineChecklists({ database: testDb })
    for (let i = 0; i < CHECKLIST_TEMPLATE_CACHE_MAX; i++) {
      await testDb.checklistTemplateCache.put({
        templateId: `t-${i}`,
        versionHash: `h-${i}`,
        name: 'N',
        discipline: 'D',
        version: 1,
        items: [{ id: 'i1', order: 1, text: 'q', isRequired: true, requiresPhoto: false }],
        cachedAt: new Date(Date.now() + i * 1000).toISOString(),
      })
    }
    expect(await testDb.checklistTemplateCache.count()).toBe(CHECKLIST_TEMPLATE_CACHE_MAX)
    await putTemplate(
      makeTemplate('t-new', 'h-new', [
        { id: 'i1', order: 1, text: 'last', isRequired: true, requiresPhoto: false },
      ]),
    )
    await pruneTemplateCache()
    expect(await testDb.checklistTemplateCache.count()).toBeLessThanOrEqual(
      CHECKLIST_TEMPLATE_CACHE_MAX,
    )
    const newest = await testDb.checklistTemplateCache.get(['t-new', 'h-new'])
    expect(newest).toBeDefined()
    const oldest = await testDb.checklistTemplateCache.get(['t-0', 'h-0'])
    expect(oldest).toBeUndefined()
  })

  it('updates cache when template version hash changes (new row)', async () => {
    const { putTemplate, getCachedTemplate } = useOfflineChecklists({ database: testDb })
    await putTemplate(
      makeTemplate('tpl-f', 'v1', [
        { id: 'a', order: 1, text: 'A', isRequired: true, requiresPhoto: false },
      ]),
    )
    await putTemplate(
      makeTemplate('tpl-f', 'v2', [
        { id: 'a', order: 1, text: 'B', isRequired: true, requiresPhoto: false },
      ]),
    )
    const a = await getCachedTemplate('tpl-f', 'v1')
    const b = await getCachedTemplate('tpl-f', 'v2')
    expect(a?.items[0]!.text).toBe('A')
    expect(b?.items[0]!.text).toBe('B')
  })
})
