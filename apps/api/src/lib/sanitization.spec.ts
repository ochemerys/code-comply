import { describe, it, expect } from 'vitest'
import {
  escapeHtml,
  isValidEmail,
  isValidUrl,
  isSafeExternalUrl,
  isPrivateOrReservedHost,
  sanitizeFilename,
  parseSanitizedNumber,
  containsSqlInjection,
  containsPathTraversal,
  neutralizeSqlMetacharacters,
  isNoSqlOperatorKey,
  sanitizeStringValue,
  sanitizeDeep,
} from './sanitization.js'

describe('sanitization (M11-S5)', () => {
  describe('escapeHtml', () => {
    it('strips script tags to prevent XSS', () => {
      const malicious = '<script>alert("xss")</script>Safe text'
      expect(escapeHtml(malicious)).toBe('Safe text')
    })

    it('escapes inline event handlers', () => {
      const malicious = '<img src=x onerror=alert(1)>'
      expect(escapeHtml(malicious)).not.toContain('onerror')
      expect(escapeHtml(malicious)).not.toContain('<img')
    })
  })

  describe('isValidEmail', () => {
    it('accepts valid email addresses', () => {
      expect(isValidEmail('inspector@example.com')).toBe(true)
    })

    it('rejects invalid email addresses', () => {
      expect(isValidEmail('not-an-email')).toBe(false)
      expect(isValidEmail('<script>@evil.com')).toBe(false)
    })
  })

  describe('isValidUrl', () => {
    it('accepts valid URLs with protocol', () => {
      expect(isValidUrl('https://example.com/path')).toBe(true)
    })

    it('rejects javascript URLs', () => {
      expect(isValidUrl('javascript:alert(1)')).toBe(false)
    })
  })

  describe('isSafeExternalUrl (M11-S7 SSRF)', () => {
    it('blocks localhost and private IP ranges', () => {
      expect(isPrivateOrReservedHost('127.0.0.1')).toBe(true)
      expect(isPrivateOrReservedHost('10.0.0.5')).toBe(true)
      expect(isPrivateOrReservedHost('192.168.1.1')).toBe(true)
      expect(isSafeExternalUrl('http://127.0.0.1/admin')).toBe(false)
      expect(isSafeExternalUrl('http://169.254.169.254/latest/meta-data/')).toBe(false)
    })

    it('allows public HTTPS URLs', () => {
      expect(isSafeExternalUrl('https://example.com/resource')).toBe(true)
    })

    it('strips SSRF URLs in sanitizeStringValue url fields', () => {
      expect(sanitizeStringValue('http://127.0.0.1/internal', 'callbackUrl')).toBe('')
      expect(sanitizeStringValue('https://example.com/ok', 'url')).toBe('https://example.com/ok')
    })
  })

  describe('sanitizeFilename', () => {
    it('prevents path traversal in file names', () => {
      expect(sanitizeFilename('..\\..\\etc\\passwd')).toBe('passwd')
      expect(sanitizeFilename('../../deep/notice.pdf')).toBe('notice.pdf')
    })

    it('replaces unsafe characters', () => {
      expect(sanitizeFilename('my file (1).pdf')).toBe('my_file_1_.pdf')
    })

    it('falls back to upload for empty results', () => {
      expect(sanitizeFilename('///')).toBe('upload')
    })
  })

  describe('parseSanitizedNumber', () => {
    it('parses finite numeric strings', () => {
      expect(parseSanitizedNumber('42')).toBe(42)
      expect(parseSanitizedNumber('-3.5')).toBe(-3.5)
    })

    it('rejects non-numeric values', () => {
      expect(parseSanitizedNumber('abc')).toBeNull()
      expect(parseSanitizedNumber(Number.NaN)).toBeNull()
      expect(parseSanitizedNumber(Infinity)).toBeNull()
    })
  })

  describe('containsSqlInjection', () => {
    it('detects common SQL injection patterns', () => {
      expect(containsSqlInjection("' OR 1=1 --")).toBe(true)
      expect(containsSqlInjection('DROP TABLE users')).toBe(true)
      expect(containsSqlInjection('normal description text')).toBe(false)
    })
  })

  describe('containsPathTraversal', () => {
    it('detects directory traversal sequences', () => {
      expect(containsPathTraversal('../secret')).toBe(true)
      expect(containsPathTraversal('..%2fetc%2fpasswd')).toBe(true)
      expect(containsPathTraversal('kitchen/outlet')).toBe(false)
    })
  })

  describe('neutralizeSqlMetacharacters', () => {
    it('removes quotes and semicolons', () => {
      expect(neutralizeSqlMetacharacters("'; DROP TABLE users; --")).toBe(' DROP TABLE users --')
    })
  })

  describe('isNoSqlOperatorKey', () => {
    it('identifies MongoDB-style operator keys', () => {
      expect(isNoSqlOperatorKey('$where')).toBe(true)
      expect(isNoSqlOperatorKey('profile.email')).toBe(true)
      expect(isNoSqlOperatorKey('description')).toBe(false)
    })
  })

  describe('sanitizeStringValue', () => {
    it('validates email fields by key name', () => {
      expect(sanitizeStringValue('User@Example.COM', 'email')).toBe('user@example.com')
      expect(sanitizeStringValue('bad-email', 'email')).toBe('')
    })

    it('sanitizes filename fields by key name', () => {
      expect(sanitizeStringValue('../../evil.pdf', 'filename')).toBe('evil.pdf')
    })
  })

  describe('sanitizeDeep', () => {
    it('recursively sanitizes nested objects and strips NoSQL operators', () => {
      const input = {
        description: '<b>Issue</b> near panel',
        email: 'sco@example.com',
        nested: {
          $gt: 0,
          note: "'; DROP TABLE deficiencies; --",
        },
      }

      const result = sanitizeDeep(input) as Record<string, unknown>
      expect(result.description).toBe('Issue near panel')
      expect(result.email).toBe('sco@example.com')
      expect((result.nested as Record<string, unknown>).$gt).toBeUndefined()
      expect((result.nested as Record<string, unknown>).note).not.toContain("'")
      expect((result.nested as Record<string, unknown>).note).not.toContain(';')
    })

    it('preserves booleans and finite numbers', () => {
      expect(sanitizeDeep({ active: true, count: 5 })).toEqual({ active: true, count: 5 })
    })

    it('sanitizes arrays of strings', () => {
      expect(sanitizeDeep(['<script>x</script>one', 'two'])).toEqual(['one', 'two'])
    })
  })
})
