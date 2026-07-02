import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import 'fake-indexeddb/auto'
import { DB_NAME, getDb, InspectorDB, resetInspectorDBSingleton } from '../dexie'
import {
  ENCRYPTED_PREFIX_V2,
  encrypt,
  EncryptionService,
  initEncryptionService,
  LEGACY_DERIVATION_SALT,
  resetEncryptionService,
} from '../encryption'
import { getOrCreateDeviceId } from '../device-id'
import {
  bootstrapEncryptionSession,
  initEncryptionForSession,
  migrateLegacyDerivationSalt,
  migratePlaintextSensitiveFields,
  reencryptSensitiveFieldsForRotatedKey,
} from '../encryption-bootstrap'
import type { LocalDeficiency, LocalInspection } from '../types'

function createInspection(overrides: Partial<LocalInspection> = {}): LocalInspection {
  return {
    id: 'insp-migrate-1',
    clientId: 'client-migrate-1',
    permitId: 'permit-migrate-1',
    status: 'SCHEDULED',
    scheduledDate: '2024-01-15T10:00:00Z',
    assignedToId: 'user-migrate-1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isDirty: false,
    ...overrides,
  }
}

function createDeficiency(overrides: Partial<LocalDeficiency> = {}): LocalDeficiency {
  return {
    id: 'def-migrate-1',
    clientId: 'client-migrate-1',
    inspectionId: 'insp-migrate-1',
    createdById: 'user-migrate-1',
    description: 'Plaintext deficiency description',
    severity: 'MAJOR',
    status: 'OPEN',
    isStopWork: false,
    isUnsafe: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isDirty: false,
    ...overrides,
  }
}

async function deleteDefaultDb(): Promise<void> {
  const rawDb = new InspectorDB(DB_NAME)
  await rawDb.delete()
}

const USER_ID = 'user-migrate-1'

function sessionSalt(): string {
  return `${USER_ID}:${getOrCreateDeviceId()}`
}

describe('encryption bootstrap', () => {
  beforeAll(() => {
    const salt = sessionSalt()
    encrypt('warmup', 'migration-test-key')
    encrypt('warmup', 'token-a', salt)
    encrypt('warmup', 'token-b', salt)
  })

  beforeEach(async () => {
    localStorage.clear()
    resetInspectorDBSingleton()
    resetEncryptionService()
    await deleteDefaultDb()
  })

  afterEach(async () => {
    resetInspectorDBSingleton()
    resetEncryptionService()
    localStorage.clear()
    await deleteDefaultDb()
  })

  it('migrates pre-existing plaintext sensitive fields to v2 ciphertext', async () => {
    const seedDb = new InspectorDB(DB_NAME)
    await seedDb.inspections.put(createInspection({ notes: 'Plaintext inspection notes' }))
    await seedDb.deficiencies.put(
      createDeficiency({ description: 'Plaintext deficiency description' }),
    )
    seedDb.close()

    initEncryptionService('migration-test-key')

    await migratePlaintextSensitiveFields(USER_ID)

    resetInspectorDBSingleton()
    const rawDb = new InspectorDB(DB_NAME)
    const inspection = await rawDb.inspections.get('insp-migrate-1')
    const deficiency = await rawDb.deficiencies.get('def-migrate-1')
    rawDb.close()

    expect(inspection?.notes).toMatch(new RegExp(`^${ENCRYPTED_PREFIX_V2}`))
    expect(inspection?.notes).not.toBe('Plaintext inspection notes')
    expect(deficiency?.description).toMatch(new RegExp(`^${ENCRYPTED_PREFIX_V2}`))
    expect(deficiency?.description).not.toBe('Plaintext deficiency description')
  })

  it('re-encrypts sensitive fields when the refresh token rotates', async () => {
    initEncryptionForSession('token-a', USER_ID)
    resetInspectorDBSingleton()

    const db = getDb()
    await db.inspections.put(createInspection({ notes: 'Secret inspection notes' }))
    await db.deficiencies.put(createDeficiency({ description: 'Secret deficiency description' }))

    await reencryptSensitiveFieldsForRotatedKey('token-a', 'token-b', USER_ID)

    resetInspectorDBSingleton()
    initEncryptionForSession('token-b', USER_ID)
    const dbAfter = getDb()

    const inspection = await dbAfter.inspections.get('insp-migrate-1')
    const deficiency = await dbAfter.deficiencies.get('def-migrate-1')

    expect(inspection?.notes).toBe('Secret inspection notes')
    expect(deficiency?.description).toBe('Secret deficiency description')
  })

  it('migrates legacy-salt ciphertext to the per-device session salt', async () => {
    const legacyService = new EncryptionService('legacy-token', LEGACY_DERIVATION_SALT)
    const seedDb = new InspectorDB(DB_NAME)
    const legacyDescription = legacyService.encryptField('Legacy deficiency description text')
    await seedDb.deficiencies.put(
      createDeficiency({
        description: legacyDescription,
      }),
    )
    seedDb.close()

    initEncryptionForSession('legacy-token', USER_ID)
    resetInspectorDBSingleton()

    await migrateLegacyDerivationSalt(USER_ID)

    const deficiency = await getDb().deficiencies.get('def-migrate-1')
    expect(deficiency?.description).toBe('Legacy deficiency description text')

    resetInspectorDBSingleton()
    const rawDb = new InspectorDB(DB_NAME)
    const atRest = await rawDb.deficiencies.get('def-migrate-1')
    rawDb.close()
    expect(atRest?.description).toMatch(new RegExp(`^${ENCRYPTED_PREFIX_V2}`))
  })

  it('bootstrapEncryptionSession re-encrypts when a previous refresh token is supplied', async () => {
    initEncryptionForSession('token-a', USER_ID)
    resetInspectorDBSingleton()

    const db = getDb()
    await db.deficiencies.put(createDeficiency({ description: 'Rotated deficiency text' }))

    await bootstrapEncryptionSession('token-b', USER_ID, { previousRefreshToken: 'token-a' })

    resetInspectorDBSingleton()
    initEncryptionForSession('token-b', USER_ID)
    const deficiency = await getDb().deficiencies.get('def-migrate-1')

    expect(deficiency?.description).toBe('Rotated deficiency text')
  })
})
