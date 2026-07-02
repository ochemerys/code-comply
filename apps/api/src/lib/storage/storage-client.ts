import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

/** Logical buckets for inspection evidence (maps to `R2_BUCKET_*` env names). */
export type StorageBucketKind = 'photos' | 'documents'

export type ObjectStorageConfig = {
  /** S3 API endpoint (R2 or MinIO), e.g. `https://<account>.r2.cloudflarestorage.com` or `http://localhost:9000` */
  endpoint?: string
  region: string
  credentials: { accessKeyId: string; secretAccessKey: string }
  bucketPhotos: string
  bucketDocuments: string
  /** Set true for MinIO and many self-hosted S3-compatible endpoints */
  forcePathStyle: boolean
}

function devStoragePublicBase(env: NodeJS.ProcessEnv = process.env): string {
  const configured = env.API_PUBLIC_URL?.trim()
  if (configured) return configured.replace(/\/$/, '')
  const port = env.PORT ?? '4000'
  return `http://localhost:${port}`
}

function memoryStoreKey(kind: StorageBucketKind, key: string): string {
  return `${kind}::${key}`
}

/**
 * Development fallback when R2/MinIO credentials are not configured (M10-S15-B1).
 * Persists objects in-process and serves downloads via the public `/dev/storage` route.
 */
export class InMemoryObjectStorageClient {
  private readonly objects = new Map<string, { body: Buffer; contentType?: string }>()

  async ensureBucketsExist(): Promise<void> {
    /* no-op */
  }

  async putObject(
    kind: StorageBucketKind,
    key: string,
    body: Uint8Array | Buffer | string,
    contentType?: string,
  ): Promise<void> {
    const buf = Buffer.isBuffer(body) ? body : Buffer.from(body)
    this.objects.set(memoryStoreKey(kind, key), { body: buf, contentType })
  }

  async getObjectBytes(kind: StorageBucketKind, key: string): Promise<Uint8Array> {
    const row = this.objects.get(memoryStoreKey(kind, key))
    if (!row) {
      throw new Error(`Object not found: ${kind}/${key}`)
    }
    return new Uint8Array(row.body)
  }

  getStoredContentType(kind: StorageBucketKind, key: string): string | undefined {
    return this.objects.get(memoryStoreKey(kind, key))?.contentType
  }

  async getSignedGetUrl(
    kind: StorageBucketKind,
    key: string,
    _expiresInSeconds: number,
  ): Promise<string> {
    const encodedKey = key
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/')
    return `${devStoragePublicBase()}/dev/storage/${kind}/${encodedKey}`
  }

  async deleteObject(kind: StorageBucketKind, key: string): Promise<void> {
    this.objects.delete(memoryStoreKey(kind, key))
  }
}

let inMemoryObjectStorageSingleton: InMemoryObjectStorageClient | undefined

export function getInMemoryObjectStorageClient(): InMemoryObjectStorageClient {
  if (!inMemoryObjectStorageSingleton) {
    inMemoryObjectStorageSingleton = new InMemoryObjectStorageClient()
  }
  return inMemoryObjectStorageSingleton
}

/** @internal test helper */
export function resetInMemoryObjectStorageForTests(): void {
  inMemoryObjectStorageSingleton = undefined
}

export function resolveObjectStorageConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): ObjectStorageConfig {
  const accessKeyId = env.R2_ACCESS_KEY_ID
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY
  if (!accessKeyId || !secretAccessKey) {
    throw new Error('R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY are required for object storage')
  }

  const bucketPhotos = env.R2_BUCKET_PHOTOS ?? 'inspection-photos'
  const bucketDocuments = env.R2_BUCKET_DOCUMENTS ?? 'inspection-documents'
  const region = env.R2_REGION ?? 'auto'
  const endpoint = env.R2_ENDPOINT?.trim() || undefined

  const forcePathStyle =
    env.R2_FORCE_PATH_STYLE === 'true' ||
    env.R2_FORCE_PATH_STYLE === '1' ||
    (!!endpoint &&
      (endpoint.includes('localhost') ||
        endpoint.includes('127.0.0.1') ||
        endpoint.includes('minio')))

  return {
    endpoint,
    region,
    credentials: { accessKeyId, secretAccessKey },
    bucketPhotos,
    bucketDocuments,
    forcePathStyle,
  }
}

export function createObjectStorageClientFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): ObjectStorageClient {
  const accessKeyId = env.R2_ACCESS_KEY_ID
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY
  if (!accessKeyId || !secretAccessKey) {
    if (env.NODE_ENV === 'production') {
      throw new Error('R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY are required for object storage')
    }
    return getInMemoryObjectStorageClient() as unknown as ObjectStorageClient
  }
  return new ObjectStorageClient(resolveObjectStorageConfigFromEnv(env))
}

/** Serves bytes stored by {@link InMemoryObjectStorageClient} (development only). */
export async function readDevStorageObject(
  kind: StorageBucketKind,
  key: string,
): Promise<{ bytes: Uint8Array; contentType: string }> {
  const client = getInMemoryObjectStorageClient()
  const bytes = await client.getObjectBytes(kind, key)
  const stored = client.getStoredContentType(kind, key)
  const contentType =
    stored ??
    (key.endsWith('.pdf')
      ? 'application/pdf'
      : key.match(/\.jpe?g$/i)
        ? 'image/jpeg'
        : key.match(/\.png$/i)
          ? 'image/png'
          : 'application/octet-stream')
  return { bytes, contentType }
}

export class ObjectStorageClient {
  private readonly s3: S3Client

  constructor(private readonly config: ObjectStorageConfig) {
    this.s3 = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      credentials: config.credentials,
      forcePathStyle: config.forcePathStyle,
    })
  }

  private bucketName(kind: StorageBucketKind): string {
    return kind === 'photos' ? this.config.bucketPhotos : this.config.bucketDocuments
  }

  /**
   * Ensures photo and document buckets exist (idempotent). Safe for dev/CI; production buckets are often pre-provisioned.
   */
  async ensureBucketsExist(): Promise<void> {
    for (const name of [this.config.bucketPhotos, this.config.bucketDocuments]) {
      try {
        await this.s3.send(new HeadBucketCommand({ Bucket: name }))
      } catch (err: unknown) {
        const status = (err as { $metadata?: { httpStatusCode?: number } })?.$metadata
          ?.httpStatusCode
        const code = (err as { name?: string })?.name
        if (code === 'NotFound' || status === 404) {
          await this.s3.send(new CreateBucketCommand({ Bucket: name }))
        } else {
          throw err
        }
      }
    }
  }

  async putObject(
    kind: StorageBucketKind,
    key: string,
    body: Uint8Array | Buffer | string,
    contentType?: string,
  ): Promise<void> {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucketName(kind),
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    )
  }

  async getObjectBytes(kind: StorageBucketKind, key: string): Promise<Uint8Array> {
    const out = await this.s3.send(
      new GetObjectCommand({
        Bucket: this.bucketName(kind),
        Key: key,
      }),
    )
    if (!out.Body) {
      throw new Error(`Object storage: empty body for ${kind}/${key}`)
    }
    return out.Body.transformToByteArray()
  }

  async getSignedGetUrl(
    kind: StorageBucketKind,
    key: string,
    expiresInSeconds: number,
  ): Promise<string> {
    const cmd = new GetObjectCommand({
      Bucket: this.bucketName(kind),
      Key: key,
    })
    return getSignedUrl(this.s3, cmd, { expiresIn: expiresInSeconds })
  }

  async deleteObject(kind: StorageBucketKind, key: string): Promise<void> {
    await this.s3.send(
      new DeleteObjectCommand({
        Bucket: this.bucketName(kind),
        Key: key,
      }),
    )
  }
}
