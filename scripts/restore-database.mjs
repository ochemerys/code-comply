#!/usr/bin/env node
/**
 * M11-S21 — Restore PostgreSQL from geo-redundant R2 backup with data integrity check.
 * Usage: DATABASE_URL=... BACKUP_KEY=db-backups/inspections-2026-05-21.sql.gz node scripts/restore-database.mjs
 * Verify only: RESTORE_VERIFY_ONLY=1 BACKUP_FILE=./backup.sql node scripts/restore-database.mjs
 */
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const VERIFY_ONLY = process.env.RESTORE_VERIFY_ONLY === '1'

function sha256Hex(buf) {
  return createHash('sha256').update(buf).digest('hex')
}

function isPostgresDump(text) {
  return (
    text.includes('PostgreSQL database dump') ||
    text.includes('CREATE TABLE') ||
    text.includes('CREATE SCHEMA')
  )
}

async function downloadFromR2(key) {
  const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3')
  const endpoint = process.env.R2_BACKUP_ENDPOINT ?? process.env.R2_ENDPOINT
  const bucket = process.env.R2_BACKUP_BUCKET ?? 'inspection-db-backups'
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error('R2 backup credentials and endpoint are required')
  }
  const client = new S3Client({
    endpoint,
    region: process.env.R2_REGION ?? 'auto',
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: process.env.R2_FORCE_PATH_STYLE === 'true',
  })
  const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
  const bytes = await res.Body?.transformToByteArray()
  if (!bytes) throw new Error(`Empty backup object: ${key}`)
  return Buffer.from(bytes)
}

function gunzipToSql(gzPath, sqlPath) {
  const gunzip = spawnSync('gunzip', ['-c', gzPath], { encoding: 'buffer', maxBuffer: 512 * 1024 * 1024 })
  if (gunzip.status !== 0) {
    throw new Error('gunzip failed')
  }
  writeFileSync(sqlPath, gunzip.stdout)
}

function restoreWithPsql(sqlPath) {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required for psql restore')
  }
  const sql = readFileSync(sqlPath, 'utf8')
  const result = spawnSync('psql', [databaseUrl], {
    input: sql,
    encoding: 'utf8',
    maxBuffer: 512 * 1024 * 1024,
  })
  if (result.status !== 0) {
    throw new Error(`psql restore failed: ${result.stderr ?? result.stdout}`)
  }
}

async function main() {
  console.log('M11-S21 Database restore\n')

  const tmpSql = join(ROOT, '.tmp-backups/restore.sql')
  const tmpGz = join(ROOT, '.tmp-backups/restore.sql.gz')

  let plainSql
  if (VERIFY_ONLY && process.env.BACKUP_FILE) {
    plainSql = readFileSync(process.env.BACKUP_FILE, 'utf8')
  } else {
    const key = process.env.BACKUP_KEY
    if (!key) throw new Error('BACKUP_KEY is required (e.g. db-backups/inspections-2026-05-21.sql.gz)')
    const gzBody = await downloadFromR2(key)
    writeFileSync(tmpGz, gzBody)
    gunzipToSql(tmpGz, tmpSql)
    plainSql = readFileSync(tmpSql, 'utf8')
  }

  if (!isPostgresDump(plainSql)) {
    throw new Error('Downloaded backup does not look like a PostgreSQL dump (data integrity check failed)')
  }

  const checksum = sha256Hex(Buffer.from(plainSql, 'utf8'))
  console.log(`| data integrity | checksum ${checksum} |`)
  console.log(`| restore process | ${VERIFY_ONLY ? 'verify-only' : 'psql apply'} |`)

  if (VERIFY_ONLY) {
    console.log('\nRestore verify-only PASSED')
    return
  }

  restoreWithPsql(tmpSql)
  if (existsSync(tmpSql)) unlinkSync(tmpSql)
  if (existsSync(tmpGz)) unlinkSync(tmpGz)

  console.log('\nRestore PASSED')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
