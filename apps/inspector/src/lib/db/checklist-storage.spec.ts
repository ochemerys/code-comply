/**
 * Unit tests for checklist execution persistence (M5-S16).
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { InspectorDB } from './dexie'
import {
  checklistResponseQueueClientId,
  checklistResponseRowId,
  clearChecklistResponseSyncAfterExecutionMissingOnServer,
  loadChecklistExecutionFromStorage,
  loadExecutionTemplateRef,
  markChecklistResponseSyncedAfterSuccessfulPush,
  mergeChecklistExecutionResponses,
  mergeServerChecklistResponses,
  migrateChecklistExecutionFromLocalStorage,
  persistChecklistExecutionState,
  removePendingChecklistResponseSyncItems,
} from './checklist-storage'
import { ChecklistTemplateUnavailableError } from './checklist-template-errors'
import { persistDefaultChecklistTemplateRef } from './checklist-template-prefetch'
import type { ChecklistExecutionDTO, ChecklistItemDTO } from '@codecomply/validators'

const items: ChecklistItemDTO[] = [
  {
    id: 'item-1',
    order: 1,
    text: 'A',
    isRequired: true,
    requiresPhoto: false,
  },
  {
    id: 'item-2',
    order: 2,
    text: 'B',
    isRequired: true,
    requiresPhoto: false,
  },
]

function makeExecution(
  responses: ChecklistExecutionDTO['responses'] = [
    { itemId: 'item-1', result: 'PASS', timestamp: '2026-01-01T12:00:00.000Z' },
  ],
): ChecklistExecutionDTO {
  return {
    id: 'exec-1',
    inspectionId: 'insp-1',
    templateId: 'tpl-1',
    versionHash: 'vh-1',
    responses,
    progress: 50,
  }
}

describe('checklist-storage', () => {
  let testDb: InspectorDB

  beforeEach(async () => {
    const dbName = `ClStorage-${Math.random().toString(36).slice(2, 9)}`
    testDb = new InspectorDB(dbName)
    await testDb.open()
  })

  afterEach(async () => {
    if (testDb.isOpen()) testDb.close()
    await testDb.delete()
  })

  it('persistChecklistExecutionState writes checklistResponses with stable ids', async () => {
    const ex = makeExecution()
    await persistChecklistExecutionState(ex, { database: testDb, queueSync: false })
    const row = await testDb.checklistResponses.get(checklistResponseRowId('exec-1', 'item-1'))
    expect(row).toMatchObject({
      checklistId: 'exec-1',
      itemId: 'item-1',
      result: 'PASS',
      isDirty: true,
    })
  })

  it('persistChecklistExecutionState enqueues sync when queueSync is true', async () => {
    const queueMutation = vi.fn(async () => 'queued-id')
    const ex = makeExecution()
    await persistChecklistExecutionState(ex, {
      database: testDb,
      queueSync: true,
      syncEngine: { queueMutation },
    })
    expect(queueMutation).toHaveBeenCalledTimes(1)
    expect(queueMutation).toHaveBeenCalledWith(
      'checklistResponse.update',
      expect.objectContaining({
        clientId: checklistResponseQueueClientId('exec-1', 'item-1'),
        executionId: 'exec-1',
        itemId: 'item-1',
      }),
      15,
    )
  })

  it('persist replaces pending queue rows for the same item', async () => {
    const queueMutation = vi.fn(async () => 'q1')
    const ex = makeExecution()
    await persistChecklistExecutionState(ex, {
      database: testDb,
      queueSync: true,
      syncEngine: { queueMutation },
    })
    await persistChecklistExecutionState(
      {
        ...ex,
        responses: [
          {
            itemId: 'item-1',
            result: 'FAIL',
            codeReference: { code: 'NBC', section: '1' },
            timestamp: '2026-01-02T12:00:00.000Z',
          },
        ],
        progress: 50,
      },
      {
        database: testDb,
        queueSync: true,
        syncEngine: { queueMutation },
      },
    )
    expect(queueMutation).toHaveBeenCalledTimes(2)
  })

  it('persistChecklistExecutionState writes checklists row for offline template ref resolution', async () => {
    await persistChecklistExecutionState(makeExecution(), { database: testDb, queueSync: false })
    const ref = await loadExecutionTemplateRef('exec-1', { database: testDb })
    expect(ref).toEqual({ templateId: 'tpl-1', versionHash: 'vh-1' })
    const row = await testDb.checklists.get('exec-1')
    expect(row?.templateId).toBe('tpl-1')
    expect(row?.isDirty).toBe(true)
  })

  it('loadChecklistExecutionFromStorage maps rows to DTOs and progress', async () => {
    await persistChecklistExecutionState(makeExecution(), { database: testDb, queueSync: false })
    const loaded = await loadChecklistExecutionFromStorage(
      {
        id: 'exec-1',
        inspectionId: 'insp-1',
        templateId: 'tpl-1',
        versionHash: 'vh-1',
      },
      items,
      { database: testDb },
    )
    expect(loaded.responses).toHaveLength(1)
    expect(loaded.responses[0]!.itemId).toBe('item-1')
    expect(loaded.progress).toBe(50)
  })

  it('persist removes responses dropped from execution', async () => {
    await persistChecklistExecutionState(makeExecution(), { database: testDb, queueSync: false })
    await persistChecklistExecutionState(
      {
        ...makeExecution(),
        responses: [],
        progress: 0,
      },
      { database: testDb, queueSync: false },
    )
    const rows = await testDb.checklistResponses.where('checklistId').equals('exec-1').toArray()
    expect(rows).toHaveLength(0)
  })

  it('mergeChecklistExecutionResponses keeps local FAIL codeReference when server FAIL lacks code', () => {
    const stored = [
      {
        itemId: 'seed-item-4',
        result: 'FAIL' as const,
        codeReference: { code: 'NBC', section: '9.10.1' },
        timestamp: '2026-06-07T10:00:00.000Z',
      },
    ]
    const remote = [
      {
        itemId: 'seed-item-4',
        result: 'FAIL' as const,
        timestamp: '2026-06-07T09:00:00.000Z',
      },
    ]
    const merged = mergeChecklistExecutionResponses(remote, stored)
    expect(merged).toHaveLength(1)
    expect(merged[0]?.codeReference?.code).toBe('NBC')
    expect(merged[0]?.codeReference?.section).toBe('9.10.1')
  })

  it('mergeChecklistExecutionResponses appends local-only responses missing on server', () => {
    const stored = [
      {
        itemId: 'item-local',
        result: 'FAIL' as const,
        codeReference: { code: 'NBC', section: '1.1' },
        timestamp: '2026-06-07T10:00:00.000Z',
      },
    ]
    const remote = [
      {
        itemId: 'item-remote',
        result: 'PASS' as const,
        timestamp: '2026-06-07T10:00:00.000Z',
      },
    ]
    const merged = mergeChecklistExecutionResponses(remote, stored)
    expect(merged.map((r) => r.itemId).sort()).toEqual(['item-local', 'item-remote'])
  })

  it('mergeServerChecklistResponses applies server when newer than local', async () => {
    await persistChecklistExecutionState(makeExecution(), { database: testDb, queueSync: false })
    await testDb.checklistResponses.update(checklistResponseRowId('exec-1', 'item-1'), {
      updatedAt: '2020-01-01T00:00:00.000Z',
    })
    await mergeServerChecklistResponses(
      'exec-1',
      [
        {
          response: {
            itemId: 'item-1',
            result: 'FAIL',
            codeReference: { code: 'NBC', section: '9.9.9' },
            timestamp: '2026-01-05T00:00:00.000Z',
          },
          serverUpdatedAt: '2026-01-10T00:00:00.000Z',
        },
      ],
      { database: testDb },
    )
    const row = await testDb.checklistResponses.get(checklistResponseRowId('exec-1', 'item-1'))
    expect(row?.result).toBe('FAIL')
    expect(row?.isDirty).toBe(false)
  })

  it('mergeServerChecklistResponses keeps local when local updatedAt is newer', async () => {
    await persistChecklistExecutionState(makeExecution(), { database: testDb, queueSync: false })
    await mergeServerChecklistResponses(
      'exec-1',
      [
        {
          response: {
            itemId: 'item-1',
            result: 'NA',
            timestamp: '2026-01-01T00:00:00.000Z',
          },
          serverUpdatedAt: '2025-12-01T00:00:00.000Z',
        },
      ],
      { database: testDb },
    )
    const row = await testDb.checklistResponses.get(checklistResponseRowId('exec-1', 'item-1'))
    expect(row?.result).toBe('PASS')
  })

  it('markChecklistResponseSyncedAfterSuccessfulPush clears queue for item', async () => {
    const queueMutation = vi.fn(async () => 'q')
    await persistChecklistExecutionState(makeExecution(), {
      database: testDb,
      queueSync: true,
      syncEngine: { queueMutation },
    })
    await markChecklistResponseSyncedAfterSuccessfulPush('exec-1', 'item-1', {
      database: testDb,
      serverUpdatedAt: '2026-02-01T00:00:00.000Z',
    })
    const row = await testDb.checklistResponses.get(checklistResponseRowId('exec-1', 'item-1'))
    expect(row?.isDirty).toBe(false)
    const pending = await testDb.syncQueue.count()
    expect(pending).toBe(0)
  })

  it('removePendingChecklistResponseSyncItems deletes matching queue rows', async () => {
    await testDb.syncQueue.add({
      id: 'q-1',
      clientId: checklistResponseQueueClientId('exec-1', 'item-1'),
      operation: 'checklistResponse.update',
      payload: {},
      status: 'PENDING',
      attempts: 0,
      maxAttempts: 3,
      createdAt: new Date().toISOString(),
      priority: 10,
    })
    await removePendingChecklistResponseSyncItems(testDb, 'exec-1', 'item-1')
    expect(await testDb.syncQueue.count()).toBe(0)
  })

  it('clearChecklistResponseSyncAfterExecutionMissingOnServer drops queue and clears dirty', async () => {
    await persistChecklistExecutionState(makeExecution(), { database: testDb, queueSync: false })
    await testDb.syncQueue.add({
      id: 'q-stale',
      clientId: checklistResponseQueueClientId('exec-1', 'item-1'),
      operation: 'checklistResponse.update',
      payload: {},
      status: 'PENDING',
      attempts: 0,
      maxAttempts: 3,
      createdAt: new Date().toISOString(),
      priority: 10,
    })
    expect(await testDb.syncQueue.count()).toBe(1)
    await clearChecklistResponseSyncAfterExecutionMissingOnServer('exec-1', 'item-1', {
      database: testDb,
    })
    expect(await testDb.syncQueue.count()).toBe(0)
    const row = await testDb.checklistResponses.get(checklistResponseRowId('exec-1', 'item-1'))
    expect(row?.isDirty).toBe(false)
  })

  it('loadExecutionTemplateRef prefers remote execution template identity', async () => {
    const ref = await loadExecutionTemplateRef('exec-ref', {
      database: testDb,
      remote: { templateId: 'tpl-remote', versionHash: 'vh-remote' },
    })
    expect(ref).toEqual({ templateId: 'tpl-remote', versionHash: 'vh-remote' })
  })

  it('loadExecutionTemplateRef reads checklist row when remote is absent', async () => {
    await testDb.checklists.put({
      id: 'exec-row',
      inspectionId: 'insp-1',
      templateId: 'tpl-row',
      versionHash: 'vh-row',
      templateName: 'T',
      discipline: 'Building',
      items: [],
      progress: 0,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      isDirty: false,
    })
    const ref = await loadExecutionTemplateRef('exec-row', { database: testDb })
    expect(ref).toEqual({ templateId: 'tpl-row', versionHash: 'vh-row' })
  })

  it('loadExecutionTemplateRef uses default ref for local-* executions', async () => {
    persistDefaultChecklistTemplateRef({ templateId: 'tpl-def', versionHash: 'vh-def' })
    const ref = await loadExecutionTemplateRef('local-insp-9', { database: testDb })
    expect(ref).toEqual({ templateId: 'tpl-def', versionHash: 'vh-def' })
  })

  it('loadExecutionTemplateRef throws when no real template identity exists', async () => {
    await expect(
      loadExecutionTemplateRef('exec-missing', { database: testDb }),
    ).rejects.toBeInstanceOf(ChecklistTemplateUnavailableError)
  })

  it('migrateChecklistExecutionFromLocalStorage moves draft into IndexedDB', async () => {
    const key = 'checklist-execution-draft-exec-m'
    const draft = {
      id: 'exec-m',
      inspectionId: 'insp-m',
      templateId: 't',
      versionHash: 'h',
      responses: [
        { itemId: 'item-1', result: 'PASS' as const, timestamp: '2026-01-01T00:00:00.000Z' },
      ],
      progress: 50,
    }
    localStorage.setItem(key, JSON.stringify(draft))
    await migrateChecklistExecutionFromLocalStorage(
      key,
      { executionId: 'exec-m', inspectionId: 'insp-m' },
      { database: testDb },
    )
    expect(
      localStorage.getItem(key),
      'draft should be removed after successful migration',
    ).toBeNull()
    const loaded = await loadChecklistExecutionFromStorage(
      { id: 'exec-m', inspectionId: 'insp-m', templateId: 't', versionHash: 'h' },
      items,
      { database: testDb },
    )
    expect(loaded.responses).toHaveLength(1)
  })
})
