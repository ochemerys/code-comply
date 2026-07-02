import { describe, expect, it } from 'vitest'
import {
  EmailInspectionDocumentDTOSchema,
  SignInspectionDocumentDTOSchema,
} from './admin-document.dto.js'

describe('admin-document DTOs', () => {
  it('parses email document body', () => {
    expect(
      EmailInspectionDocumentDTOSchema.parse({
        to: ['owner@example.com'],
        message: 'Please review',
      }),
    ).toEqual({ to: ['owner@example.com'], message: 'Please review' })
  })

  it('rejects invalid signature data URL', () => {
    expect(() =>
      SignInspectionDocumentDTOSchema.parse({ signatureDataUrl: 'not-an-image' }),
    ).toThrow()
  })
})
