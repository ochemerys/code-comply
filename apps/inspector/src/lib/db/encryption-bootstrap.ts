/**
 * Session encryption bootstrap: init from auth tokens, migrate legacy plaintext, teardown on logout.
 *
 * @see NFR-M-03 — Encryption of data in IndexedDB
 */

import { getDb, openInspectorDBAtRest, resetInspectorDBSingleton } from './dexie'
import {
  clearDerivedKeyCache,
  EncryptionService,
  getEncryptionService,
  initEncryptionService,
  isEncrypted,
  LEGACY_DERIVATION_SALT,
  resetEncryptionService,
  SENSITIVE_FIELDS,
  tryDecryptWithFallback,
} from './encryption'
import { getOrCreateDeviceId } from './device-id'
import type { LocalDeficiency, LocalInspection } from './types'

export type BootstrapEncryptionSessionOptions = {
  /** Previous refresh token before rotation; triggers re-encryption when it differs. */
  previousRefreshToken?: string | null
}

const MIGRATION_FLAG_PREFIX = 'inspector_sensitive_fields_migrated:'
const LEGACY_SALT_MIGRATION_FLAG_PREFIX = 'inspector_legacy_salt_migrated:'

let encryptionBootstrapInFlight: Promise<void> | null = null

function migrationFlagKey(userId: string): string {
  return `${MIGRATION_FLAG_PREFIX}${userId}`
}

function legacySaltMigrationFlagKey(userId: string): string {
  return `${LEGACY_SALT_MIGRATION_FLAG_PREFIX}${userId}`
}

function buildDerivationSalt(userId: string, deviceId: string): string {
  return `${userId}:${deviceId}`
}

/**
 * Derives and installs the per-session encryption service from the refresh token.
 * Call after successful login or session restore, before any IndexedDB writes.
 */
export function initEncryptionForSession(refreshToken: string, userId: string): void {
  if (!refreshToken || !userId) {
    throw new Error('initEncryptionForSession requires refreshToken and userId')
  }
  const deviceId = getOrCreateDeviceId()
  const salt = buildDerivationSalt(userId, deviceId)
  initEncryptionService(refreshToken, salt)
}

/**
 * Clears encryption state on logout or remote wipe.
 */
export function teardownEncryptionSession(): void {
  resetInspectorDBSingleton()
  resetEncryptionService()
  clearDerivedKeyCache()
}

/**
 * Re-encrypts legacy plaintext sensitive fields already on disk (one-shot per user).
 */
export async function migratePlaintextSensitiveFields(userId: string): Promise<void> {
  if (typeof localStorage === 'undefined') return

  const flagKey = migrationFlagKey(userId)
  if (localStorage.getItem(flagKey) === '1') return

  getEncryptionService()
  const db = getDb()

  await db.transaction('rw', db.inspections, db.deficiencies, async () => {
    const inspections = await db.inspections.toArray()
    for (const row of inspections) {
      const fields = SENSITIVE_FIELDS.inspections ?? []
      const needsMigration = fields.some((field) => {
        const value = row[field as keyof typeof row]
        return typeof value === 'string' && value.length > 0 && !isEncrypted(value)
      })
      if (needsMigration) {
        await db.inspections.put(row)
      }
    }

    const deficiencies = await db.deficiencies.toArray()
    for (const row of deficiencies) {
      const fields = SENSITIVE_FIELDS.deficiencies ?? []
      const needsMigration = fields.some((field) => {
        const value = row[field as keyof typeof row]
        return typeof value === 'string' && value.length > 0 && !isEncrypted(value)
      })
      if (needsMigration) {
        await db.deficiencies.put(row)
      }
    }
  })

  localStorage.setItem(flagKey, '1')
}

/**
 * Re-encrypts sensitive fields that were stored with the legacy default salt.
 */
export async function migrateLegacyDerivationSalt(userId: string): Promise<void> {
  if (typeof localStorage === 'undefined') return

  const flagKey = legacySaltMigrationFlagKey(userId)
  if (localStorage.getItem(flagKey) === '1') return

  const service = getEncryptionService()
  const sessionSalt = service.getDerivationSalt()
  if (sessionSalt === LEGACY_DERIVATION_SALT) {
    localStorage.setItem(flagKey, '1')
    return
  }

  const rawDb = openInspectorDBAtRest()
  const inspectionsToRewrite: LocalInspection[] = []
  const deficienciesToRewrite: LocalDeficiency[] = []

  try {
    for (const row of await rawDb.inspections.toArray()) {
      let next: LocalInspection | null = null
      for (const field of SENSITIVE_FIELDS.inspections ?? []) {
        const value = row[field as keyof LocalInspection]
        if (typeof value !== 'string' || !isEncrypted(value)) continue
        const decrypted = tryDecryptWithFallback(value, service.getKey(), sessionSalt)
        if (decrypted?.usedLegacySalt) {
          next = { ...(next ?? row), [field]: decrypted.plaintext } as LocalInspection
        }
      }
      if (next) inspectionsToRewrite.push(next)
    }

    for (const row of await rawDb.deficiencies.toArray()) {
      let next: LocalDeficiency | null = null
      for (const field of SENSITIVE_FIELDS.deficiencies ?? []) {
        const value = row[field as keyof LocalDeficiency]
        if (typeof value !== 'string' || !isEncrypted(value)) continue
        const decrypted = tryDecryptWithFallback(value, service.getKey(), sessionSalt)
        if (decrypted?.usedLegacySalt) {
          next = { ...(next ?? row), [field]: decrypted.plaintext } as LocalDeficiency
        }
      }
      if (next) deficienciesToRewrite.push(next)
    }
  } finally {
    rawDb.close()
  }

  if (inspectionsToRewrite.length > 0 || deficienciesToRewrite.length > 0) {
    const db = getDb()
    await db.transaction('rw', db.inspections, db.deficiencies, async () => {
      for (const row of inspectionsToRewrite) {
        await db.inspections.put(row)
      }
      for (const row of deficienciesToRewrite) {
        await db.deficiencies.put(row)
      }
    })
  }

  localStorage.setItem(flagKey, '1')
}

/**
 * Decrypts sensitive fields for token rotation using the previous refresh token.
 */
function decryptSensitiveFieldsForRotation<T extends LocalInspection | LocalDeficiency>(
  service: EncryptionService,
  tableName: string,
  record: T,
): T {
  const fields = SENSITIVE_FIELDS[tableName] ?? []
  let updated: T = { ...record }

  for (const field of fields) {
    const key = field as keyof T
    const value = updated[key]
    if (typeof value === 'string' && value.length > 0 && isEncrypted(value)) {
      const decrypted = tryDecryptWithFallback(value, service.getKey(), service.getDerivationSalt())
      if (decrypted) {
        updated = { ...updated, [key]: decrypted.plaintext } as T
      }
    }
  }

  return updated
}

/**
 * Re-encrypts on-disk sensitive fields after the refresh token (encryption key) changes.
 * Reads ciphertext at rest (no middleware), decrypts with the previous key, installs the
 * new key, then writes rows back through Dexie so middleware stores ciphertext under the new key.
 */
export async function reencryptSensitiveFieldsForRotatedKey(
  previousRefreshToken: string,
  newRefreshToken: string,
  userId: string,
): Promise<void> {
  if (!previousRefreshToken || !newRefreshToken || previousRefreshToken === newRefreshToken) {
    return
  }

  const deviceId = getOrCreateDeviceId()
  const salt = buildDerivationSalt(userId, deviceId)
  const previousService = new EncryptionService(previousRefreshToken, salt)

  const rawDb = openInspectorDBAtRest()
  let inspections: LocalInspection[]
  let deficiencies: LocalDeficiency[]
  try {
    inspections = (await rawDb.inspections.toArray()).map((row) =>
      decryptSensitiveFieldsForRotation(previousService, 'inspections', row),
    )
    deficiencies = (await rawDb.deficiencies.toArray()).map((row) =>
      decryptSensitiveFieldsForRotation(previousService, 'deficiencies', row),
    )
  } finally {
    rawDb.close()
  }

  initEncryptionForSession(newRefreshToken, userId)

  const db = getDb()
  await db.transaction('rw', db.inspections, db.deficiencies, async () => {
    for (const row of inspections) {
      await db.inspections.put(row)
    }
    for (const row of deficiencies) {
      await db.deficiencies.put(row)
    }
  })
}

async function runBootstrapEncryptionSession(
  refreshToken: string,
  userId: string,
  options: BootstrapEncryptionSessionOptions = {},
): Promise<void> {
  const previousRefreshToken = options.previousRefreshToken

  if (previousRefreshToken && previousRefreshToken !== refreshToken) {
    await reencryptSensitiveFieldsForRotatedKey(previousRefreshToken, refreshToken, userId)
    await migratePlaintextSensitiveFields(userId)
    await migrateLegacyDerivationSalt(userId)
    return
  }

  initEncryptionForSession(refreshToken, userId)
  await migratePlaintextSensitiveFields(userId)
  await migrateLegacyDerivationSalt(userId)
}

/**
 * Initializes encryption and runs the plaintext migration when authenticated.
 * Serialized so concurrent refresh/bootstrap calls cannot interleave key rotation.
 */
export async function bootstrapEncryptionSession(
  refreshToken: string,
  userId: string,
  options: BootstrapEncryptionSessionOptions = {},
): Promise<void> {
  while (encryptionBootstrapInFlight) {
    await encryptionBootstrapInFlight
  }

  const task = runBootstrapEncryptionSession(refreshToken, userId, options)
  encryptionBootstrapInFlight = task

  try {
    await task
  } finally {
    if (encryptionBootstrapInFlight === task) {
      encryptionBootstrapInFlight = null
    }
  }
}
