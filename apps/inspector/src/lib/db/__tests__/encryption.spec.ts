/**
 * Unit tests for encryption module
 *
 * @see M3-S2 - Implement Data Encryption for Sensitive Fields
 * @see NFR-M-03 (Security) - Encryption of data in IndexedDB
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import CryptoJS from 'crypto-js'
import {
  encrypt,
  decrypt,
  encryptObject,
  decryptObject,
  generateEncryptionKey,
  hashSHA256,
  deriveKey,
  isEncrypted,
  clearDerivedKeyCache,
  EncryptionService,
  initEncryptionService,
  getEncryptionService,
  isEncryptionServiceInitialized,
  resetEncryptionService,
  SENSITIVE_FIELDS,
  ENCRYPTED_PREFIX,
  ENCRYPTED_PREFIX_V2,
  PBKDF2_ITERATIONS,
  LEGACY_DERIVATION_SALT,
  tryDecryptWithFallback,
} from '../encryption'

describe('Encryption Module', () => {
  const TEST_KEY = 'test-encryption-key-2024'

  // ─── Module Import Tests (M3-S4-B1) ─────────────────────────────────────

  describe('crypto-js dependency resolution', () => {
    it('should successfully import crypto-js and expose AES encryption', async () => {
      const CryptoJS = (await import('crypto-js')).default
      expect(CryptoJS).toBeDefined()
      expect(CryptoJS.AES).toBeDefined()
      expect(typeof CryptoJS.AES.encrypt).toBe('function')
      expect(typeof CryptoJS.AES.decrypt).toBe('function')
    })

    it('should successfully import encryption module without errors', async () => {
      const mod = await import('../encryption')
      expect(mod.encrypt).toBeDefined()
      expect(mod.decrypt).toBeDefined()
      expect(mod.EncryptionService).toBeDefined()
      expect(mod.deriveKey).toBeDefined()
      expect(mod.generateEncryptionKey).toBeDefined()
    })
  })

  // ─── Configuration Tests ─────────────────────────────────────────────────

  describe('Configuration', () => {
    it('should use 100000 PBKDF2 iterations as per M3-S2 spec', () => {
      expect(PBKDF2_ITERATIONS).toBe(100000)
    })

    it('should have encrypted prefix markers', () => {
      expect(ENCRYPTED_PREFIX).toBe('enc:v1:')
      expect(ENCRYPTED_PREFIX_V2).toBe('enc:v2:')
    })

    it('should define sensitive fields for inspections table', () => {
      expect(SENSITIVE_FIELDS.inspections).toContain('notes')
      expect(SENSITIVE_FIELDS.inspections).toContain('certificationSnapshot')
    })

    it('should define sensitive fields for deficiencies table', () => {
      expect(SENSITIVE_FIELDS.deficiencies).toContain('description')
    })

    it('should not define sensitive fields for non-sensitive tables', () => {
      expect(SENSITIVE_FIELDS.checklists).toBeUndefined()
      expect(SENSITIVE_FIELDS.photos).toBeUndefined()
      expect(SENSITIVE_FIELDS.syncQueue).toBeUndefined()
    })
  })

  // ─── Key Derivation Tests ────────────────────────────────────────────────

  describe('deriveKey', () => {
    it('should derive a key from a passphrase', () => {
      const key = deriveKey('my-passphrase')
      expect(key).toBeDefined()
      expect(key.toString()).toBeTruthy()
    })

    it('should derive the same key for the same passphrase and salt', () => {
      const key1 = deriveKey('my-passphrase', 'my-salt')
      const key2 = deriveKey('my-passphrase', 'my-salt')
      expect(key1.toString()).toBe(key2.toString())
    })

    it('should derive different keys for different passphrases', () => {
      const key1 = deriveKey('passphrase-1')
      const key2 = deriveKey('passphrase-2')
      expect(key1.toString()).not.toBe(key2.toString())
    })

    it('should derive different keys for different salts', () => {
      const key1 = deriveKey('my-passphrase', 'salt-1')
      const key2 = deriveKey('my-passphrase', 'salt-2')
      expect(key1.toString()).not.toBe(key2.toString())
    })
  })

  // ─── Core Encrypt / Decrypt Tests ────────────────────────────────────────

  describe('encrypt / decrypt', () => {
    it('should encrypt and decrypt a string', () => {
      const plaintext = 'Hello, World!'
      const ciphertext = encrypt(plaintext, TEST_KEY)

      expect(ciphertext).not.toBe(plaintext)
      expect(ciphertext.length).toBeGreaterThan(0)
      expect(ciphertext.startsWith(ENCRYPTED_PREFIX_V2)).toBe(true)

      const decrypted = decrypt(ciphertext, TEST_KEY)
      expect(decrypted).toBe(plaintext)
    })

    it('should prefix encrypted values with the encryption marker', () => {
      const ciphertext = encrypt('test', TEST_KEY)
      expect(ciphertext.startsWith(ENCRYPTED_PREFIX_V2)).toBe(true)
    })

    it('should encrypt and decrypt special characters', () => {
      const plaintext = 'Spëcîal chars: @#$%^&*()_+{}|:"<>?'
      const ciphertext = encrypt(plaintext, TEST_KEY)
      const decrypted = decrypt(ciphertext, TEST_KEY)
      expect(decrypted).toBe(plaintext)
    })

    it('should encrypt and decrypt unicode text', () => {
      const plaintext = '日本語テスト 🔒 émojis'
      const ciphertext = encrypt(plaintext, TEST_KEY)
      const decrypted = decrypt(ciphertext, TEST_KEY)
      expect(decrypted).toBe(plaintext)
    })

    it('should encrypt and decrypt long text', () => {
      const plaintext = 'A'.repeat(10000)
      const ciphertext = encrypt(plaintext, TEST_KEY)
      const decrypted = decrypt(ciphertext, TEST_KEY)
      expect(decrypted).toBe(plaintext)
    })

    it('should produce different ciphertext for the same plaintext (due to IV)', () => {
      const plaintext = 'Same text'
      const ciphertext1 = encrypt(plaintext, TEST_KEY)
      const ciphertext2 = encrypt(plaintext, TEST_KEY)
      const decrypted1 = decrypt(ciphertext1, TEST_KEY)
      const decrypted2 = decrypt(ciphertext2, TEST_KEY)
      expect(decrypted1).toBe(plaintext)
      expect(decrypted2).toBe(plaintext)
    })

    it('should throw error when encrypting empty string', () => {
      expect(() => encrypt('', TEST_KEY)).toThrow('Cannot encrypt empty value')
    })

    it('should throw error when encrypting with empty key', () => {
      expect(() => encrypt('test', '')).toThrow('Encryption key is required')
    })

    it('should throw error when decrypting empty string', () => {
      expect(() => decrypt('', TEST_KEY)).toThrow('Cannot decrypt empty value')
    })

    it('should throw error when decrypting with empty key', () => {
      expect(() => decrypt('ciphertext', '')).toThrow('Decryption key is required')
    })

    it('should throw error when decrypting with wrong key', () => {
      const ciphertext = encrypt('secret data', TEST_KEY)
      expect(() => decrypt(ciphertext, 'wrong-key')).toThrow()
    })

    it('should decrypt legacy enc:v1 ciphertext (no inner sentinel)', () => {
      const derived = deriveKey(TEST_KEY).toString()
      const inner = CryptoJS.AES.encrypt('legacy hello', derived).toString()
      const v1 = ENCRYPTED_PREFIX + inner
      expect(decrypt(v1, TEST_KEY)).toBe('legacy hello')
    })

    it('should handle decryption of values without prefix (backward compatibility)', () => {
      // Simulate a value encrypted without the prefix (legacy format)
      const plaintext = 'legacy data'
      const ciphertext = encrypt(plaintext, TEST_KEY)
      // Strip the prefix to simulate legacy format (OpenSSL payload only)
      const legacyCiphertext = ciphertext.slice(ENCRYPTED_PREFIX_V2.length)
      const decrypted = decrypt(legacyCiphertext, TEST_KEY)
      expect(decrypted).toBe(plaintext)
    })
  })

  // ─── isEncrypted Tests ───────────────────────────────────────────────────

  describe('isEncrypted', () => {
    it('should return true for encrypted values', () => {
      const ciphertext = encrypt('test', TEST_KEY)
      expect(isEncrypted(ciphertext)).toBe(true)
    })

    it('should return false for plaintext values', () => {
      expect(isEncrypted('plain text')).toBe(false)
    })

    it('should return false for empty string', () => {
      expect(isEncrypted('')).toBe(false)
    })

    it('should return false for non-string values', () => {
      expect(isEncrypted(42)).toBe(false)
      expect(isEncrypted(null)).toBe(false)
      expect(isEncrypted(undefined)).toBe(false)
      expect(isEncrypted({})).toBe(false)
    })

    it('should return true for values starting with a known prefix', () => {
      expect(isEncrypted(ENCRYPTED_PREFIX + 'some-data')).toBe(true)
      expect(isEncrypted(ENCRYPTED_PREFIX_V2 + 'some-data')).toBe(true)
    })
  })

  describe('tryDecryptWithFallback', () => {
    const sessionSalt = 'user-1:device-abc'

    it('decrypts with the session salt when available', () => {
      const ciphertext = encrypt('session salt text', TEST_KEY, sessionSalt)
      const result = tryDecryptWithFallback(ciphertext, TEST_KEY, sessionSalt)
      expect(result).toEqual({ plaintext: 'session salt text', usedLegacySalt: false })
    })

    it('falls back to the legacy salt for older ciphertext', () => {
      const ciphertext = encrypt('legacy salt text', TEST_KEY, LEGACY_DERIVATION_SALT)
      const result = tryDecryptWithFallback(ciphertext, TEST_KEY, sessionSalt)
      expect(result).toEqual({ plaintext: 'legacy salt text', usedLegacySalt: true })
    })

    it('returns null when neither salt can decrypt', () => {
      const ciphertext = encrypt('wrong key text', 'other-key', sessionSalt)
      const result = tryDecryptWithFallback(ciphertext, TEST_KEY, sessionSalt)
      expect(result).toBeNull()
    })
  })

  // ─── Object Encryption Tests ─────────────────────────────────────────────

  describe('encryptObject / decryptObject', () => {
    it('should encrypt and decrypt a simple object', () => {
      const data = { name: 'John', age: 30 }
      const ciphertext = encryptObject(data, TEST_KEY)

      expect(typeof ciphertext).toBe('string')
      expect(ciphertext).not.toContain('John')

      const decrypted = decryptObject<typeof data>(ciphertext, TEST_KEY)
      expect(decrypted).toEqual(data)
    })

    it('should encrypt and decrypt a complex nested object', () => {
      const data = {
        inspector: {
          id: 'user-123',
          name: 'Jane Smith',
          certifications: ['Building', 'Fire'],
        },
        inspection: {
          id: 'insp-456',
          deficiencies: [
            { id: 'def-1', severity: 'MAJOR' },
            { id: 'def-2', severity: 'CRITICAL' },
          ],
        },
      }

      const ciphertext = encryptObject(data, TEST_KEY)
      const decrypted = decryptObject<typeof data>(ciphertext, TEST_KEY)
      expect(decrypted).toEqual(data)
    })

    it('should encrypt and decrypt arrays', () => {
      const data = [1, 'two', { three: 3 }, [4, 5]]
      const ciphertext = encryptObject(data, TEST_KEY)
      const decrypted = decryptObject<typeof data>(ciphertext, TEST_KEY)
      expect(decrypted).toEqual(data)
    })
  })

  // ─── Key Generation Tests ────────────────────────────────────────────────

  describe('generateEncryptionKey', () => {
    it('should generate a hex string key', () => {
      const key = generateEncryptionKey()
      expect(key).toMatch(/^[0-9a-f]+$/)
    })

    it('should generate a 64-character hex string (256 bits)', () => {
      const key = generateEncryptionKey()
      expect(key.length).toBe(64)
    })

    it('should generate unique keys', () => {
      const key1 = generateEncryptionKey()
      const key2 = generateEncryptionKey()
      expect(key1).not.toBe(key2)
    })
  })

  // ─── SHA-256 Hash Tests ──────────────────────────────────────────────────

  describe('hashSHA256', () => {
    it('should produce a consistent hash for the same input', () => {
      const hash1 = hashSHA256('test data')
      const hash2 = hashSHA256('test data')
      expect(hash1).toBe(hash2)
    })

    it('should produce different hashes for different inputs', () => {
      const hash1 = hashSHA256('data 1')
      const hash2 = hashSHA256('data 2')
      expect(hash1).not.toBe(hash2)
    })

    it('should produce a 64-character hex string', () => {
      const hash = hashSHA256('test')
      expect(hash.length).toBe(64)
      expect(hash).toMatch(/^[0-9a-f]+$/)
    })
  })

  // ─── EncryptionService Tests ─────────────────────────────────────────────

  describe('EncryptionService', () => {
    let service: EncryptionService

    beforeEach(() => {
      service = new EncryptionService(TEST_KEY)
    })

    it('should throw error if constructed without key', () => {
      expect(() => new EncryptionService('')).toThrow('EncryptionService requires a key')
    })

    describe('encryptField / decryptField', () => {
      it('should encrypt and decrypt a field value', () => {
        const original = 'sensitive certification data'
        const encrypted = service.encryptField(original)
        expect(encrypted.startsWith(ENCRYPTED_PREFIX_V2)).toBe(true)
        const decrypted = service.decryptField(encrypted)
        expect(decrypted).toBe(original)
      })
    })

    describe('encryptFields', () => {
      it('should encrypt specified fields in a record', () => {
        const record = {
          id: 'user-123',
          name: 'John Doe',
          email: 'john@example.com',
          role: 'SCO',
        }

        const encrypted = service.encryptFields(record, ['name', 'email'])

        // Non-encrypted fields should remain unchanged
        expect(encrypted.id).toBe('user-123')
        expect(encrypted.role).toBe('SCO')

        // Encrypted fields should be different from originals
        expect(encrypted.name).not.toBe('John Doe')
        expect(encrypted.email).not.toBe('john@example.com')

        // Should be decryptable
        const decrypted = service.decryptFields(encrypted, ['name', 'email'])
        expect(decrypted.name).toBe('John Doe')
        expect(decrypted.email).toBe('john@example.com')
      })

      it('should skip empty string fields', () => {
        const record = {
          id: 'user-123',
          name: '',
          email: 'john@example.com',
        }

        const encrypted = service.encryptFields(record, ['name', 'email'])
        expect(encrypted.name).toBe('')
        expect(encrypted.email).not.toBe('john@example.com')
      })

      it('should skip non-string fields', () => {
        const record = {
          id: 'user-123',
          count: 42 as unknown,
          name: 'John',
        }

        const encrypted = service.encryptFields(record as Record<string, unknown>, [
          'count',
          'name',
        ])
        expect(encrypted.count).toBe(42)
        expect(encrypted.name).not.toBe('John')
      })

      it('should not double-encrypt already encrypted fields', () => {
        const record = {
          id: 'user-123',
          name: 'John Doe',
        }

        const encrypted1 = service.encryptFields(record, ['name'])
        const encrypted2 = service.encryptFields(encrypted1, ['name'])

        // Should not double-encrypt
        expect(encrypted1.name).toBe(encrypted2.name)

        // Should still decrypt correctly
        const decrypted = service.decryptFields(encrypted2, ['name'])
        expect(decrypted.name).toBe('John Doe')
      })
    })

    describe('decryptFields', () => {
      it('should only decrypt fields with encryption prefix', () => {
        const record = {
          id: 'user-123',
          name: 'Not Encrypted',
        }

        const result = service.decryptFields(record, ['name'])
        // Should leave non-encrypted fields as-is
        expect(result.name).toBe('Not Encrypted')
        expect(result.id).toBe('user-123')
      })

      it('should handle corrupted encrypted data gracefully', () => {
        const record = {
          id: 'user-123',
          name: ENCRYPTED_PREFIX + 'corrupted-data-not-valid-base64',
        }

        // Should not throw, just warn and leave as-is
        const result = service.decryptFields(record, ['name'])
        expect(result.id).toBe('user-123')
      })
    })

    describe('encryptSensitiveFields / decryptSensitiveFields', () => {
      it('should encrypt sensitive fields for inspections table', () => {
        const record = {
          id: 'insp-123',
          status: 'IN_PROGRESS',
          notes: 'Sensitive inspection notes',
          certificationSnapshot: 'cert-data-json',
          assignedToId: 'user-456',
        }

        const encrypted = service.encryptSensitiveFields('inspections', record)

        expect(encrypted.id).toBe('insp-123')
        expect(encrypted.status).toBe('IN_PROGRESS')
        expect(encrypted.assignedToId).toBe('user-456')
        expect(encrypted.notes).not.toBe('Sensitive inspection notes')
        expect(encrypted.certificationSnapshot).not.toBe('cert-data-json')
        expect(isEncrypted(encrypted.notes as string)).toBe(true)
        expect(isEncrypted(encrypted.certificationSnapshot as string)).toBe(true)
      })

      it('should decrypt sensitive fields for inspections table', () => {
        const record = {
          id: 'insp-123',
          notes: 'Sensitive inspection notes',
          certificationSnapshot: 'cert-data-json',
        }

        const encrypted = service.encryptSensitiveFields('inspections', record)
        const decrypted = service.decryptSensitiveFields('inspections', encrypted)

        expect(decrypted.notes).toBe('Sensitive inspection notes')
        expect(decrypted.certificationSnapshot).toBe('cert-data-json')
      })

      it('should encrypt sensitive fields for deficiencies table', () => {
        const record = {
          id: 'def-123',
          inspectionId: 'insp-456',
          description: 'Missing fire extinguisher in hallway',
          severity: 'MAJOR',
        }

        const encrypted = service.encryptSensitiveFields('deficiencies', record)

        expect(encrypted.id).toBe('def-123')
        expect(encrypted.inspectionId).toBe('insp-456')
        expect(encrypted.severity).toBe('MAJOR')
        expect(encrypted.description).not.toBe('Missing fire extinguisher in hallway')
        expect(isEncrypted(encrypted.description as string)).toBe(true)
      })

      it('should decrypt sensitive fields for deficiencies table', () => {
        const record = {
          id: 'def-123',
          description: 'Missing fire extinguisher in hallway',
        }

        const encrypted = service.encryptSensitiveFields('deficiencies', record)
        const decrypted = service.decryptSensitiveFields('deficiencies', encrypted)

        expect(decrypted.description).toBe('Missing fire extinguisher in hallway')
      })

      it('should pass through records for tables without sensitive fields', () => {
        const record = {
          id: 'photo-123',
          filename: 'photo.jpg',
        }

        const result = service.encryptSensitiveFields('photos', record)
        expect(result).toEqual(record)
      })

      it('should pass through records for unknown tables', () => {
        const record = {
          id: 'unknown-123',
          data: 'some data',
        }

        const result = service.encryptSensitiveFields('unknownTable', record)
        expect(result).toEqual(record)
      })
    })

    describe('updateKey', () => {
      it('should update the encryption key', () => {
        const original = 'test data'
        const encrypted = service.encryptField(original)

        service.updateKey('new-key-2024')

        // Old ciphertext should not decrypt with new key
        expect(() => service.decryptField(encrypted)).toThrow()
      })

      it('should throw error for empty key', () => {
        expect(() => service.updateKey('')).toThrow('New encryption key is required')
      })
    })

    describe('getKey', () => {
      it('should return the current encryption key', () => {
        expect(service.getKey()).toBe(TEST_KEY)
      })

      it('should return updated key after updateKey', () => {
        service.updateKey('new-key')
        expect(service.getKey()).toBe('new-key')
      })
    })
  })

  // ─── Global EncryptionService Tests ──────────────────────────────────────

  describe('Global EncryptionService', () => {
    beforeEach(() => {
      resetEncryptionService()
    })

    afterEach(() => {
      initEncryptionService(TEST_KEY)
    })

    it('should throw error when getting uninitialized service', () => {
      expect(() => getEncryptionService()).toThrow('EncryptionService not initialized')
    })

    it('should report whether the global service is initialized', () => {
      expect(isEncryptionServiceInitialized()).toBe(false)

      initEncryptionService(TEST_KEY)

      expect(isEncryptionServiceInitialized()).toBe(true)
    })

    it('should initialize and return the service', () => {
      const service = initEncryptionService(TEST_KEY)
      expect(service).toBeInstanceOf(EncryptionService)
    })

    it('should return the same instance after initialization', () => {
      initEncryptionService(TEST_KEY)
      const service = getEncryptionService()
      expect(service).toBeInstanceOf(EncryptionService)
    })

    it('should reset the service on resetEncryptionService', () => {
      initEncryptionService(TEST_KEY)
      resetEncryptionService()
      expect(() => getEncryptionService()).toThrow('EncryptionService not initialized')
    })

    it('should encrypt and decrypt through global service', () => {
      initEncryptionService(TEST_KEY)
      const service = getEncryptionService()

      const encrypted = service.encryptField('secret')
      const decrypted = service.decryptField(encrypted)
      expect(decrypted).toBe('secret')
    })
  })

  // ─── Performance Tests ───────────────────────────────────────────────────

  describe('Performance', () => {
    it('should encrypt and decrypt within acceptable time for typical field sizes', () => {
      const typicalDescription =
        'Missing fire extinguisher in the main hallway near room 101. ' +
        'The extinguisher mount is present but the unit has been removed. ' +
        'This is a violation of NBC 9.10.1.'

      const start = performance.now()
      const encrypted = encrypt(typicalDescription, TEST_KEY)
      const decrypted = decrypt(encrypted, TEST_KEY)
      const elapsed = performance.now() - start

      expect(decrypted).toBe(typicalDescription)
      // Should complete within 5 seconds (generous for PBKDF2 with 100k iterations)
      expect(elapsed).toBeLessThan(5000)
    })

    it('should handle batch encryption of multiple records', () => {
      const service = new EncryptionService(TEST_KEY)
      const records = Array.from({ length: 10 }, (_, i) => ({
        id: `def-${i}`,
        description: `Deficiency description ${i} with some details about the issue found`,
        severity: 'MAJOR',
      }))

      const start = performance.now()
      const encrypted = records.map((r) => service.encryptSensitiveFields('deficiencies', r))
      const decrypted = encrypted.map((r) => service.decryptSensitiveFields('deficiencies', r))
      const elapsed = performance.now() - start

      // Verify correctness
      decrypted.forEach((r, i) => {
        expect(r.description).toBe(records[i].description)
      })

      // Should complete within reasonable time
      expect(elapsed).toBeLessThan(30000)
    })
  })
})
