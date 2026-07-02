import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest'
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import {
  InMemoryObjectStorageClient,
  ObjectStorageClient,
  createObjectStorageClientFromEnv,
  resetInMemoryObjectStorageForTests,
  resolveObjectStorageConfigFromEnv,
} from './storage-client'

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn().mockResolvedValue('https://example.com/presigned'),
}))

const baseConfig = {
  region: 'auto',
  credentials: { accessKeyId: 'ak', secretAccessKey: 'sk' },
  bucketPhotos: 'inspection-photos',
  bucketDocuments: 'inspection-documents',
  forcePathStyle: true,
} as const

describe('resolveObjectStorageConfigFromEnv', () => {
  it('reads buckets, region, endpoint, and enables path style for localhost', () => {
    const cfg = resolveObjectStorageConfigFromEnv({
      R2_ACCESS_KEY_ID: 'a',
      R2_SECRET_ACCESS_KEY: 'b',
      R2_ENDPOINT: 'http://localhost:9000',
      R2_BUCKET_PHOTOS: 'p',
      R2_BUCKET_DOCUMENTS: 'd',
      R2_REGION: 'us-east-1',
    })
    expect(cfg).toMatchObject({
      endpoint: 'http://localhost:9000',
      region: 'us-east-1',
      bucketPhotos: 'p',
      bucketDocuments: 'd',
      forcePathStyle: true,
      credentials: { accessKeyId: 'a', secretAccessKey: 'b' },
    })
  })

  it('defaults bucket names and region', () => {
    const cfg = resolveObjectStorageConfigFromEnv({
      R2_ACCESS_KEY_ID: 'a',
      R2_SECRET_ACCESS_KEY: 'b',
    })
    expect(cfg.bucketPhotos).toBe('inspection-photos')
    expect(cfg.bucketDocuments).toBe('inspection-documents')
    expect(cfg.region).toBe('auto')
  })

  it('throws when credentials are missing', () => {
    expect(() => resolveObjectStorageConfigFromEnv({})).toThrow(/required/)
  })
})

describe('createObjectStorageClientFromEnv', () => {
  afterEach(() => {
    resetInMemoryObjectStorageForTests()
  })

  it('constructs a client', () => {
    const client = createObjectStorageClientFromEnv({
      R2_ACCESS_KEY_ID: 'a',
      R2_SECRET_ACCESS_KEY: 'b',
    })
    expect(client).toBeInstanceOf(ObjectStorageClient)
  })

  it('uses in-memory storage in development when R2 credentials are missing (M10-S15-B1)', () => {
    const client = createObjectStorageClientFromEnv({
      NODE_ENV: 'development',
    })
    expect(client).toBeInstanceOf(InMemoryObjectStorageClient)
  })

  it('still requires R2 credentials in production', () => {
    expect(() =>
      createObjectStorageClientFromEnv({
        NODE_ENV: 'production',
      }),
    ).toThrow(/required/)
  })
})

describe('ObjectStorageClient', () => {
  /** S3Client#send is heavily overloaded; use a loose spy type so Vitest matches AWS SDK signatures. */
  let sendSpy: MockInstance

  beforeEach(() => {
    sendSpy = vi.spyOn(S3Client.prototype, 'send').mockImplementation(async (command) => {
      if (command instanceof GetObjectCommand) {
        const enc = new TextEncoder()
        return {
          Body: {
            transformToByteArray: async () => enc.encode('file-bytes'),
          },
        }
      }
      return {}
    })
  })

  afterEach(() => {
    sendSpy.mockRestore()
  })

  it('putObject sends PutObjectCommand with bucket and key', async () => {
    const client = new ObjectStorageClient({ ...baseConfig, endpoint: 'http://localhost:9000' })
    const body = new TextEncoder().encode('x')
    await client.putObject('photos', 'k1.jpg', body, 'image/jpeg')

    const putCalls = sendSpy.mock.calls
      .map((c) => c[0])
      .filter((c) => c instanceof PutObjectCommand)
    expect(putCalls).toHaveLength(1)
    const input = putCalls[0].input
    expect(input.Bucket).toBe('inspection-photos')
    expect(input.Key).toBe('k1.jpg')
    expect(input.ContentType).toBe('image/jpeg')
  })

  it('getObjectBytes returns bytes from GetObject', async () => {
    const client = new ObjectStorageClient(baseConfig)
    const bytes = await client.getObjectBytes('documents', 'doc.pdf')
    expect(new TextDecoder().decode(bytes)).toBe('file-bytes')

    const getCalls = sendSpy.mock.calls
      .map((c) => c[0])
      .filter((c) => c instanceof GetObjectCommand)
    expect(getCalls[0].input.Bucket).toBe('inspection-documents')
    expect(getCalls[0].input.Key).toBe('doc.pdf')
  })

  it('deleteObject sends DeleteObjectCommand', async () => {
    const client = new ObjectStorageClient(baseConfig)
    await client.deleteObject('photos', 'a/b.png')

    const del = sendSpy.mock.calls.map((c) => c[0]).find((c) => c instanceof DeleteObjectCommand)
    expect(del?.input).toMatchObject({
      Bucket: 'inspection-photos',
      Key: 'a/b.png',
    })
  })

  it('ensureBucketsExist creates bucket when HeadBucket returns NotFound', async () => {
    let headCount = 0
    sendSpy.mockImplementation(async (command) => {
      if (command instanceof HeadBucketCommand) {
        headCount += 1
        if (headCount === 1) {
          const err = Object.assign(new Error('NotFound'), {
            name: 'NotFound',
            $metadata: { httpStatusCode: 404 },
          })
          throw err
        }
        return {}
      }
      if (command instanceof CreateBucketCommand) {
        return {}
      }
      if (command instanceof GetObjectCommand) {
        const enc = new TextEncoder()
        return { Body: { transformToByteArray: async () => enc.encode('') } }
      }
      return {}
    })

    const client = new ObjectStorageClient(baseConfig)
    await client.ensureBucketsExist()

    const creates = sendSpy.mock.calls
      .map((c) => c[0])
      .filter((c) => c instanceof CreateBucketCommand)
    expect(creates.length).toBeGreaterThanOrEqual(1)
  })

  it('getSignedGetUrl delegates to presigner', async () => {
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner')
    const client = new ObjectStorageClient(baseConfig)
    const url = await client.getSignedGetUrl('photos', 'k', 60)
    expect(url).toBe('https://example.com/presigned')
    expect(vi.mocked(getSignedUrl)).toHaveBeenCalled()
  })
})
