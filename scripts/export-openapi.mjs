/**
 * Exports live GET /openapi.json to apps/api/openapi.yaml (M11-S22).
 * Run: node scripts/export-openapi.mjs
 */
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const apiDir = join(ROOT, 'apps/api')

console.log('M11-S22 — Export OpenAPI spec to apps/api/openapi.yaml\n')

const result = spawnSync(
  'pnpm',
  ['exec', 'vitest', 'run', '__tests__/export-openapi.spec.ts'],
  { cwd: apiDir, encoding: 'utf8', stdio: 'pipe' },
)

if (result.stdout) process.stdout.write(result.stdout)
if (result.stderr) process.stderr.write(result.stderr)

if (result.status !== 0) {
  console.error('\nExport failed.')
  process.exit(result.status ?? 1)
}

console.log('\nOpenAPI export complete.')
