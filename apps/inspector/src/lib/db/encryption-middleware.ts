/**
 * Dexie Encryption Middleware
 *
 * Provides transparent encryption/decryption of sensitive fields
 * in IndexedDB records. When this middleware is applied to the
 * InspectorDB, sensitive fields are automatically:
 * - Encrypted before being written to IndexedDB
 * - Decrypted when read from IndexedDB
 *
 * This makes encryption completely transparent to application code.
 * Components and composables work with plaintext data while the
 * middleware ensures data-at-rest is encrypted.
 *
 * @module lib/db/encryption-middleware
 * @see M3-S2 - Implement Data Encryption for Sensitive Fields
 * @see NFR-M-03 (Security) - Encryption of data in IndexedDB
 */

import * as Sentry from '@sentry/vue'
import type Dexie from 'dexie'
import type { DBCoreTable, DBCoreGetRequest, DBCoreMutateRequest } from 'dexie'
import { getEncryptionService, SENSITIVE_FIELDS } from './encryption'

function assertEncryptionServiceReady(operation: 'encrypt' | 'decrypt', tableName: string): void {
  try {
    getEncryptionService()
  } catch (err) {
    const message = `EncryptionService not initialized during ${operation} on ${tableName}`
    if (import.meta.env.DEV) {
      throw new Error(message)
    }
    console.error(message, err)
    Sentry.addBreadcrumb({
      category: 'encryption',
      message,
      level: 'error',
      data: { operation, tableName },
    })
    throw new Error(message)
  }
}

/**
 * Checks if a table has sensitive fields that need encryption.
 *
 * @param tableName - The Dexie table name
 * @returns true if the table has fields configured for encryption
 */
function hasSensitiveFields(tableName: string): boolean {
  const fields = SENSITIVE_FIELDS[tableName]
  return !!fields && fields.length > 0
}

/**
 * Encrypts sensitive fields in a single record for a given table.
 *
 * @param tableName - The table name
 * @param record - The record to encrypt
 * @returns A new record with sensitive fields encrypted
 */
function encryptRecord<T extends Record<string, unknown>>(tableName: string, record: T): T {
  assertEncryptionServiceReady('encrypt', tableName)
  return getEncryptionService().encryptSensitiveFields(tableName, record)
}

/**
 * Decrypts sensitive fields in a single record for a given table.
 *
 * @param tableName - The table name
 * @param record - The record to decrypt
 * @returns A new record with sensitive fields decrypted
 */
function decryptRecord<T extends Record<string, unknown>>(tableName: string, record: T): T {
  assertEncryptionServiceReady('decrypt', tableName)
  return getEncryptionService().decryptSensitiveFields(tableName, record)
}

/**
 * Applies the encryption middleware to a Dexie database instance.
 *
 * This middleware intercepts all read and write operations on tables
 * that have sensitive fields configured in SENSITIVE_FIELDS, and
 * automatically encrypts/decrypts those fields.
 *
 * @param db - The Dexie database instance to apply middleware to
 *
 * @example
 * ```typescript
 * import { InspectorDB } from './dexie'
 * import { applyEncryptionMiddleware } from './encryption-middleware'
 *
 * const db = new InspectorDB()
 * applyEncryptionMiddleware(db)
 * ```
 */
export function applyEncryptionMiddleware(db: Dexie): void {
  db.use({
    stack: 'dbcore',
    name: 'encryptionMiddleware',
    create(downlevelDatabase) {
      return {
        ...downlevelDatabase,
        table(tableName: string): DBCoreTable {
          const downlevelTable = downlevelDatabase.table(tableName)

          if (!hasSensitiveFields(tableName)) {
            return downlevelTable
          }

          return {
            ...downlevelTable,
            name: downlevelTable.name,
            schema: downlevelTable.schema,

            // Intercept mutate (add, put, update, delete)
            mutate(req: DBCoreMutateRequest) {
              if (req.type === 'add' || req.type === 'put') {
                const encryptedValues = req.values.map((value: Record<string, unknown>) =>
                  encryptRecord(tableName, value),
                )
                return downlevelTable.mutate({
                  ...req,
                  values: encryptedValues,
                })
              }
              return downlevelTable.mutate(req)
            },

            // Intercept get (single record)
            get(req: DBCoreGetRequest) {
              return downlevelTable.get(req).then((result) => {
                if (result) {
                  return decryptRecord(tableName, result as Record<string, unknown>)
                }
                return result
              })
            },

            // Intercept getMany
            getMany(req) {
              return downlevelTable.getMany(req).then((results) => {
                return results.map((result) => {
                  if (result) {
                    return decryptRecord(tableName, result as Record<string, unknown>)
                  }
                  return result
                })
              })
            },

            // Intercept query
            query(req) {
              return downlevelTable.query(req).then((queryResult) => {
                return {
                  ...queryResult,
                  result: queryResult.result.map((result: unknown) => {
                    if (result && typeof result === 'object') {
                      return decryptRecord(tableName, result as Record<string, unknown>)
                    }
                    return result
                  }),
                }
              })
            },

            // Intercept openCursor
            openCursor(req) {
              return downlevelTable.openCursor(req).then((cursor) => {
                if (!cursor) return cursor

                const proxiedCursor = Object.create(cursor)

                Object.defineProperty(proxiedCursor, 'value', {
                  get() {
                    const value = cursor.value
                    if (value && typeof value === 'object') {
                      return decryptRecord(tableName, value as Record<string, unknown>)
                    }
                    return value
                  },
                })

                proxiedCursor.continue = cursor.continue.bind(cursor)
                proxiedCursor.continuePrimaryKey = cursor.continuePrimaryKey?.bind(cursor)
                proxiedCursor.advance = cursor.advance.bind(cursor)
                proxiedCursor.start = cursor.start.bind(cursor)
                proxiedCursor.stop = cursor.stop.bind(cursor)
                proxiedCursor.next = cursor.next.bind(cursor)
                proxiedCursor.fail = cursor.fail?.bind(cursor)

                Object.defineProperty(proxiedCursor, 'key', {
                  get() {
                    return cursor.key
                  },
                })

                Object.defineProperty(proxiedCursor, 'primaryKey', {
                  get() {
                    return cursor.primaryKey
                  },
                })

                return proxiedCursor
              })
            },
          }
        },
      }
    },
  })
}
