#!/usr/bin/env node
/**
 * M11-S21 — Daily PostgreSQL backup with geo-redundant Cloudflare R2 upload.
 * Usage: DATABASE_URL=... R2_BACKUP_BUCKET=... node scripts/backup-database.mjs
 * Dry run (no DB/R2): BACKUP_DRY_RUN=1 node scripts/backup-database.mjs
 */
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync, unlinkSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const RETENTION_DAYS = Number(process.env.BACKUP_RETENTION_DAYS ?? '30')
const BUCKET = process.env.R2_BACKUP_BUCKET ?? 'inspection-db-backups'
const GEO_BUCKET = process.env.R2_BACKUP_GEO_BUCKET ?? `${BUCKET}-geo`
const DRY_RUN = process.env.BACKUP_DRY_RUN === '1'

function sha256Hex(buf) {
  return createHash('sha256').update(buf).digest('hex')
}

async function loadS3Client() {
  const mod = await import('@aws-sdk/client-s3')
  return mod
}

function buildS3Client(endpoint) {
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
  if (!accessKeyId || !secretAccessKey) {
    throw new Error('R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY are required for geo-redundant backup upload')
  }
  return {
    endpoint,
    region: process.env.R2_REGION ?? 'auto',
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: process.env.R2_FORCE_PATH_STYLE === 'true',
  }
}

async function uploadBackup(key, body, targetEndpoint, targetBucket) {
  const { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand } =
    await loadS3Client()
  const cfg = buildS3Client(targetEndpoint)
  const client = new S3Client({
    endpoint: cfg.endpoint,
    region: cfg.region,
    credentials: cfg.credentials,
    forcePathStyle: cfg.forcePathStyle,
  })

  await client.send(
    new PutObjectCommand({
      Bucket: targetBucket,
      Key: key,
      Body: body,
      ServerSideEncryption: 'AES256',
      ContentType: 'application/gzip',
    }),
  )

  const listed = await client.send(
    new ListObjectsV2Command({ Bucket: targetBucket, Prefix: 'db-backups/' }),
  )
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000
  for (const obj of listed.Contents ?? []) {
    if (obj.LastModified && obj.LastModified.getTime() < cutoff && obj.Key) {
      await client.send(new DeleteObjectCommand({ Bucket: targetBucket, Key: obj.Key }))
    }
  }
}

function runPgDump(outPath) {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required for pg_dump backup creation')
  }
  const result = spawnSync('pg_dump', ['--no-owner', '--format=plain', databaseUrl], {
    encoding: 'buffer',
    maxBuffer: 512 * 1024 * 1024,
  })
  if (result.status !== 0) {
    throw new Error(`pg_dump failed: ${result.stderr?.toString() ?? 'unknown error'}`)
  }
  writeFileSync(outPath, result.stdout)
}

async function main() {
  const stamp = new Date().toISOString().slice(0, 10)
  const key = `db-backups/inspections-${stamp}.sql.gz`
  const tmpDir = join(ROOT, '.tmp-backups')
  mkdirSync(tmpDir, { recursive: true })
  const sqlPath = join(tmpDir, `backup-${stamp}.sql`)
  const gzPath = `${sqlPath}.gz`

  console.log('M11-S21 Database backup\n')
  console.log(`| Retention | ${RETENTION_DAYS} days |`)
  console.log(`| Primary bucket | ${BUCKET} |`)
  console.log(`| Geo-redundant bucket | ${GEO_BUCKET} |`)
  console.log(`| Encryption | AES256 (server-side) |`)

  if (DRY_RUN) {
    console.log('\nBACKUP_DRY_RUN=1 — skipping pg_dump and R2 upload')
    console.log('Backup dry run PASSED')
    return
  }

  runPgDump(sqlPath)
  const sql = readFileSync(sqlPath)
  const gzip = spawnSync('gzip', ['-c', sqlPath], { encoding: 'buffer' })
  if (gzip.status !== 0) {
    throw new Error('gzip compression failed')
  }
  writeFileSync(gzPath, gzip.stdout)
  const checksum = sha256Hex(sql)
  writeFileSync(`${gzPath}.sha256`, `${checksum}  ${key}\n`)

  const primaryEndpoint = process.env.R2_BACKUP_ENDPOINT ?? process.env.R2_ENDPOINT
  const geoEndpoint = process.env.R2_BACKUP_GEO_ENDPOINT ?? process.env.R2_ENDPOINT
  if (!primaryEndpoint || !geoEndpoint) {
    throw new Error('R2_BACKUP_ENDPOINT or R2_ENDPOINT is required for geo-redundant storage')
  }

  const body = readFileSync(gzPath)
  await uploadBackup(key, body, primaryEndpoint, BUCKET)
  await uploadBackup(key, body, geoEndpoint, GEO_BUCKET)

  if (existsSync(sqlPath)) unlinkSync(sqlPath)
  if (existsSync(gzPath)) unlinkSync(gzPath)

  console.log(`\nBackup uploaded: ${key}`)
  console.log(`Checksum (plain SQL): ${checksum}`)
  console.log('Geo-redundant copy completed')
  console.log('\nBackup PASSED')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
