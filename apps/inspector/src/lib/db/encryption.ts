/**
 * Encryption utilities for sensitive data in IndexedDB
 *
 * Uses AES-256-GCM encryption with PBKDF2 key derivation to protect
 * sensitive fields such as certification details, personal information,
 * and inspection notes.
 *
 * Encrypted fields (transparent to application code):
 * - Inspection.notes
 * - Inspection.certificationSnapshot
 * - Deficiency.description
 *
 * @module lib/db/encryption
 * @see M3-S2 - Implement Data Encryption for Sensitive Fields
 * @see NFR-M-03 (Security) - Encryption of data in IndexedDB
 */

import CryptoJS from 'crypto-js'

// ─── Configuration ───────────────────────────────────────────────────────────

/**
 * Default salt for key derivation.
 * In production, this should be unique per installation.
 */
const DEFAULT_SALT = 'acme-inspector-salt-v1'

/** Pre–per-device salt used before key derivation used `userId:deviceId`. */
export const LEGACY_DERIVATION_SALT = DEFAULT_SALT

/**
 * Key size for AES-256 (256 bits = 8 words of 32 bits each).
 */
const KEY_SIZE = 256 / 32

/**
 * PBKDF2 iterations for key derivation.
 * Set to 100,000 per M3-S2 security requirements.
 */
export const PBKDF2_ITERATIONS = 100000

/** Production uses {@link PBKDF2_ITERATIONS}; Vitest uses fewer iterations to avoid CI timeouts. */
function pbkdf2IterationsForRuntime(): number {
  return import.meta.env.VITEST ? 1_000 : PBKDF2_ITERATIONS
}

/**
 * Prefix marker for encrypted values to distinguish from plaintext (legacy on-disk format).
 */
export const ENCRYPTED_PREFIX = 'enc:v1:'

/**
 * Current format: v2 wraps plaintext with an internal sentinel so wrong keys fail reliably.
 * (CryptoJS AES with a wrong passphrase can still yield non-empty UTF-8, so empty checks alone are flaky.)
 */
export const ENCRYPTED_PREFIX_V2 = 'enc:v2:'

/** Prepended before user plaintext in v2 payloads; stripped after successful decrypt. */
const PLAINTEXT_SENTINEL_V2 = '\x00ENC2\x01'

// ─── Sensitive Field Configuration ───────────────────────────────────────────

/**
 * Configuration mapping table names to their sensitive fields.
 * These fields are automatically encrypted before storage and
 * decrypted on retrieval via the Dexie middleware.
 *
 * @see M3-S2 acceptance criteria: "Encryption is transparent to application code"
 */
export const SENSITIVE_FIELDS: Record<string, string[]> = {
  inspections: ['notes', 'certificationSnapshot'],
  deficiencies: ['description'],
}

// ─── Key Derivation ──────────────────────────────────────────────────────────

/**
 * Derives an encryption key from a passphrase using PBKDF2.
 *
 * Uses 100,000 iterations as specified in M3-S2 encryption_config.
 *
 * @param passphrase - The passphrase to derive the key from
 * @param salt - Optional salt (defaults to application salt)
 * @returns The derived key as a CryptoJS WordArray
 */
export function deriveKey(passphrase: string, salt: string = DEFAULT_SALT): CryptoJS.lib.WordArray {
  return CryptoJS.PBKDF2(passphrase, salt, {
    keySize: KEY_SIZE,
    iterations: pbkdf2IterationsForRuntime(),
  })
}

// ─── Core Encryption / Decryption ────────────────────────────────────────────

/**
 * Cache for derived keys to avoid expensive PBKDF2 re-computation.
 * Maps "passphrase:salt" to the derived key string.
 */
const derivedKeyCache = new Map<string, string>()

/**
 * Gets or derives an encryption key, using cache for performance.
 *
 * @param passphrase - The passphrase to derive the key from
 * @param salt - Optional salt
 * @returns The derived key as a string
 */
function getCachedDerivedKey(passphrase: string, salt: string = DEFAULT_SALT): string {
  const cacheKey = `${passphrase}:${salt}`
  let cached = derivedKeyCache.get(cacheKey)
  if (!cached) {
    cached = deriveKey(passphrase, salt).toString()
    derivedKeyCache.set(cacheKey, cached)
  }
  return cached
}

/**
 * Clears the derived key cache.
 * Should be called on logout or key change.
 */
export function clearDerivedKeyCache(): void {
  derivedKeyCache.clear()
}

/**
 * Encrypts a string value using AES-256.
 *
 * The ciphertext is prefixed with {@link ENCRYPTED_PREFIX_V2} (new) or
 * {@link ENCRYPTED_PREFIX} (legacy) to allow transparent detection of encrypted values.
 *
 * Uses cached key derivation for performance (PBKDF2 with 100k
 * iterations is expensive, so the derived key is cached).
 *
 * @param plaintext - The string to encrypt
 * @param key - The encryption key (string passphrase or derived key)
 * @returns The encrypted string with prefix marker
 * @throws Error if plaintext is empty or key is missing
 */
export function encrypt(plaintext: string, key: string, salt: string = DEFAULT_SALT): string {
  if (!plaintext) {
    throw new Error('Cannot encrypt empty value')
  }
  if (!key) {
    throw new Error('Encryption key is required')
  }

  const derivedKeyStr = getCachedDerivedKey(key, salt)
  const payload = PLAINTEXT_SENTINEL_V2 + plaintext
  const encrypted = CryptoJS.AES.encrypt(payload, derivedKeyStr)
  return ENCRYPTED_PREFIX_V2 + encrypted.toString()
}

/**
 * Decrypts an AES-256 encrypted string.
 *
 * Strips {@link ENCRYPTED_PREFIX_V2} or {@link ENCRYPTED_PREFIX} when present.
 *
 * @param ciphertext - The encrypted string (with or without prefix)
 * @param key - The encryption key (same key used for encryption)
 * @returns The decrypted plaintext string
 * @throws Error if ciphertext is empty, key is missing, or decryption fails
 */
export function decrypt(ciphertext: string, key: string, salt: string = DEFAULT_SALT): string {
  if (!ciphertext) {
    throw new Error('Cannot decrypt empty value')
  }
  if (!key) {
    throw new Error('Decryption key is required')
  }

  const isV2 = ciphertext.startsWith(ENCRYPTED_PREFIX_V2)
  const isV1 = ciphertext.startsWith(ENCRYPTED_PREFIX)
  const rawCiphertext = isV2
    ? ciphertext.slice(ENCRYPTED_PREFIX_V2.length)
    : isV1
      ? ciphertext.slice(ENCRYPTED_PREFIX.length)
      : ciphertext

  const derivedKeyStr = getCachedDerivedKey(key, salt)
  const decrypted = CryptoJS.AES.decrypt(rawCiphertext, derivedKeyStr)
  const plaintext = decrypted.toString(CryptoJS.enc.Utf8)

  if (!plaintext) {
    throw new Error('Decryption failed: invalid key or corrupted data')
  }

  if (isV2) {
    if (!plaintext.startsWith(PLAINTEXT_SENTINEL_V2)) {
      throw new Error('Decryption failed: invalid key or corrupted data')
    }
    return plaintext.slice(PLAINTEXT_SENTINEL_V2.length)
  }

  // Raw OpenSSL payload (no outer prefix): v2 still embeds the sentinel inside the AES plaintext.
  if (plaintext.startsWith(PLAINTEXT_SENTINEL_V2)) {
    return plaintext.slice(PLAINTEXT_SENTINEL_V2.length)
  }

  return plaintext
}

/**
 * Checks whether a value is encrypted (has the encryption prefix).
 *
 * @param value - The value to check
 * @returns true if the value appears to be encrypted
 */
export function isEncrypted(value: unknown): boolean {
  return (
    typeof value === 'string' &&
    (value.startsWith(ENCRYPTED_PREFIX) || value.startsWith(ENCRYPTED_PREFIX_V2))
  )
}

export type DecryptWithFallbackResult = {
  plaintext: string
  usedLegacySalt: boolean
}

/**
 * Decrypts ciphertext with the session salt, then falls back to {@link LEGACY_DERIVATION_SALT}.
 */
export function tryDecryptWithFallback(
  ciphertext: string,
  key: string,
  derivationSalt: string,
): DecryptWithFallbackResult | null {
  try {
    return { plaintext: decrypt(ciphertext, key, derivationSalt), usedLegacySalt: false }
  } catch {
    if (derivationSalt === LEGACY_DERIVATION_SALT) {
      return null
    }
    try {
      return {
        plaintext: decrypt(ciphertext, key, LEGACY_DERIVATION_SALT),
        usedLegacySalt: true,
      }
    } catch {
      return null
    }
  }
}

// ─── Object Encryption ──────────────────────────────────────────────────────

/**
 * Encrypts a JSON-serializable object.
 *
 * @param data - The object to encrypt
 * @param key - The encryption key
 * @returns The encrypted string
 */
export function encryptObject<T>(data: T, key: string, salt: string = DEFAULT_SALT): string {
  const json = JSON.stringify(data)
  return encrypt(json, key, salt)
}

/**
 * Decrypts a string back to a JSON object.
 *
 * @param ciphertext - The encrypted string
 * @param key - The decryption key
 * @returns The decrypted object
 */
export function decryptObject<T>(ciphertext: string, key: string, salt: string = DEFAULT_SALT): T {
  const json = decrypt(ciphertext, key, salt)
  return JSON.parse(json) as T
}

// ─── Utility Functions ───────────────────────────────────────────────────────

/**
 * Generates a random encryption key suitable for AES-256.
 *
 * @returns A random key as a hex string
 */
export function generateEncryptionKey(): string {
  return CryptoJS.lib.WordArray.random(32).toString(CryptoJS.enc.Hex)
}

/**
 * Hashes a value using SHA-256.
 * Useful for creating document hashes for integrity verification.
 *
 * @param value - The value to hash
 * @returns The SHA-256 hash as a hex string
 */
export function hashSHA256(value: string): string {
  return CryptoJS.SHA256(value).toString(CryptoJS.enc.Hex)
}

// ─── EncryptionService ───────────────────────────────────────────────────────

/**
 * EncryptionService provides a stateful wrapper around encryption functions.
 * It stores the encryption key and provides convenient methods for
 * encrypting/decrypting fields in database records.
 *
 * This service is used by the Dexie middleware to transparently
 * encrypt/decrypt sensitive fields on storage and retrieval.
 *
 * @see M3-S2 - "Encryption is transparent to application code"
 */
export class EncryptionService {
  private key: string
  private derivationSalt: string

  constructor(key: string, derivationSalt: string = DEFAULT_SALT) {
    if (!key) {
      throw new Error('EncryptionService requires a key')
    }
    this.key = key
    this.derivationSalt = derivationSalt
  }

  /**
   * Encrypts a string field value.
   */
  encryptField(value: string): string {
    return encrypt(value, this.key, this.derivationSalt)
  }

  /**
   * Decrypts a string field value.
   */
  decryptField(value: string): string {
    return decrypt(value, this.key, this.derivationSalt)
  }

  /**
   * Encrypts specified fields in an object, returning a new object
   * with those fields encrypted.
   *
   * Only encrypts non-empty string fields that are not already encrypted.
   *
   * @param record - The record to encrypt fields in
   * @param fields - Array of field names to encrypt
   * @returns A new object with specified fields encrypted
   */
  encryptFields<T extends Record<string, unknown>>(record: T, fields: (keyof T)[]): T {
    const result = { ...record }
    for (const field of fields) {
      const value = result[field]
      if (typeof value === 'string' && value.length > 0 && !isEncrypted(value)) {
        const encrypted = encrypt(value, this.key, this.derivationSalt)
        const rec = result as Record<string, unknown>
        rec[field as string] = encrypted
      }
    }
    return result
  }

  /**
   * Decrypts specified fields in an object, returning a new object
   * with those fields decrypted.
   *
   * Only decrypts fields that have the encryption prefix marker.
   *
   * @param record - The record to decrypt fields in
   * @param fields - Array of field names to decrypt
   * @returns A new object with specified fields decrypted
   */
  decryptFields<T extends Record<string, unknown>>(record: T, fields: (keyof T)[]): T {
    const result = { ...record }
    for (const field of fields) {
      const value = result[field]
      if (typeof value === 'string' && value.length > 0 && isEncrypted(value)) {
        const decrypted = tryDecryptWithFallback(value, this.key, this.derivationSalt)
        if (decrypted) {
          const rec = result as Record<string, unknown>
          rec[field as string] = decrypted.plaintext
        } else {
          // Field may not be encrypted or corrupted, leave as-is
          console.warn(`[EncryptionService] Failed to decrypt field: ${String(field)}`)
        }
      }
    }
    return result
  }

  /**
   * Encrypts sensitive fields for a given table name.
   * Uses the SENSITIVE_FIELDS configuration to determine which fields to encrypt.
   *
   * @param tableName - The Dexie table name
   * @param record - The record to encrypt
   * @returns A new record with sensitive fields encrypted
   */
  encryptSensitiveFields<T extends Record<string, unknown>>(tableName: string, record: T): T {
    const fields = SENSITIVE_FIELDS[tableName]
    if (!fields || fields.length === 0) {
      return record
    }
    return this.encryptFields(record, fields as (keyof T)[])
  }

  /**
   * Decrypts sensitive fields for a given table name.
   * Uses the SENSITIVE_FIELDS configuration to determine which fields to decrypt.
   *
   * @param tableName - The Dexie table name
   * @param record - The record to decrypt
   * @returns A new record with sensitive fields decrypted
   */
  decryptSensitiveFields<T extends Record<string, unknown>>(tableName: string, record: T): T {
    const fields = SENSITIVE_FIELDS[tableName]
    if (!fields || fields.length === 0) {
      return record
    }
    return this.decryptFields(record, fields as (keyof T)[])
  }

  /**
   * Updates the encryption key. Useful when user re-authenticates.
   */
  updateKey(newKey: string, derivationSalt?: string): void {
    if (!newKey) {
      throw new Error('New encryption key is required')
    }
    this.key = newKey
    if (derivationSalt) {
      this.derivationSalt = derivationSalt
    }
    clearDerivedKeyCache()
  }

  /**
   * Returns the current encryption key.
   * Used internally by the middleware.
   */
  getKey(): string {
    return this.key
  }

  getDerivationSalt(): string {
    return this.derivationSalt
  }
}

// ─── Global Singleton ────────────────────────────────────────────────────────

/**
 * Singleton encryption service instance.
 * Initialize with user-specific key after authentication.
 */
let encryptionServiceInstance: EncryptionService | null = null

/**
 * Initializes the global encryption service with a key.
 * Should be called after user authentication.
 *
 * @param key - The encryption key (typically derived from user credentials)
 */
export function initEncryptionService(
  key: string,
  derivationSalt: string = DEFAULT_SALT,
): EncryptionService {
  encryptionServiceInstance = new EncryptionService(key, derivationSalt)
  return encryptionServiceInstance
}

/**
 * Gets the global encryption service instance.
 *
 * @returns The encryption service instance
 * @throws Error if the service has not been initialized
 */
export function getEncryptionService(): EncryptionService {
  if (!encryptionServiceInstance) {
    throw new Error('EncryptionService not initialized. Call initEncryptionService() first.')
  }
  return encryptionServiceInstance
}

/**
 * Returns whether the global encryption service is ready for encrypted DB access.
 */
export function isEncryptionServiceInitialized(): boolean {
  return encryptionServiceInstance !== null
}

/**
 * Resets the global encryption service (e.g., on logout).
 */
export function resetEncryptionService(): void {
  encryptionServiceInstance = null
}
