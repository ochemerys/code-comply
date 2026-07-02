import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { randomBytes } from 'node:crypto'
import {
  createObjectStorageClientFromEnv,
  resolveObjectStorageConfigFromEnv,
  type ObjectStorageClient,
} from '../../src/lib/storage/storage-client'

const enabled = process.env.STORAGE_INTEGRATION_TEST === '1'

/** Vitest 1.x does not support `describe.sequential.skipIf`; branch between sequential and skip instead. */
const describeStorage = enabled ? describe.sequential : describe.skip

describeStorage('ObjectStorageClient integration (R2 / MinIO)', () => {
  let client: ObjectStorageClient
  const testPrefix = `it-${Date.now()}-${randomBytes(4).toString('hex')}`
  const photoKey = `${testPrefix}/photo.txt`
  const docKey = `${testPrefix}/memo.txt`

  beforeAll(async () => {
    resolveObjectStorageConfigFromEnv()
    client = createObjectStorageClientFromEnv()
    await client.ensureBucketsExist()
  })

  afterAll(async () => {
    await client.deleteObject('photos', photoKey).catch(() => {})
    await client.deleteObject('documents', docKey).catch(() => {})
  })

  it('uploads and downloads from photos bucket', async () => {
    const payload = new TextEncoder().encode('integration-photos')
    await client.putObject('photos', photoKey, payload, 'text/plain')
    const roundTrip = await client.getObjectBytes('photos', photoKey)
    expect(new TextDecoder().decode(roundTrip)).toBe('integration-photos')
  })

  it('uploads and downloads from documents bucket', async () => {
    const payload = new TextEncoder().encode('integration-docs')
    await client.putObject('documents', docKey, payload, 'text/plain')
    const roundTrip = await client.getObjectBytes('documents', docKey)
    expect(new TextDecoder().decode(roundTrip)).toBe('integration-docs')
  })

  it('returns a signed GET URL that can fetch the object', async () => {
    const url = await client.getSignedGetUrl('photos', photoKey, 120)
    expect(url).toMatch(/^https?:\/\//)
    const res = await fetch(url)
    expect(res.ok).toBe(true)
    const text = await res.text()
    expect(text).toBe('integration-photos')
  })
})
