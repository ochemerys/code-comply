#!/usr/bin/env node
/**
 * Aggregates vitest coverage-final.json files and checks M11-S14 targets.
 * Run after: pnpm test:coverage
 */
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

/** @type {Array<{ name: string; path: string; targets?: { overall: number; services?: number } }>} */
const PACKAGES = [
  {
    name: '@codecomply/api',
    path: 'apps/api/coverage/coverage-final.json',
    targets: { overall: 80, services: 90 },
  },
  {
    name: '@codecomply/inspector',
    path: 'apps/inspector/coverage/coverage-final.json',
    targets: { overall: 80 },
  },
  {
    name: '@codecomply/admin',
    path: 'apps/admin/coverage/coverage-final.json',
    targets: { overall: 80 },
  },
  {
    name: '@codecomply/utils',
    path: 'packages/utils/coverage/coverage-final.json',
    targets: { overall: 85 },
  },
  {
    name: '@codecomply/validators',
    path: 'packages/validators/coverage/coverage-final.json',
    targets: { overall: 80 },
  },
  {
    name: '@codecomply/ui',
    path: 'packages/ui/coverage/coverage-final.json',
    targets: { overall: 75 },
  },
]

function pct(covered, total) {
  return total === 0 ? 100 : (covered / total) * 100
}

function summarize(filePath) {
  const raw = JSON.parse(readFileSync(filePath, 'utf8'))
  let stmtCovered = 0
  let stmtTotal = 0
  let fnCovered = 0
  let fnTotal = 0
  let branchCovered = 0
  let branchTotal = 0

  for (const entry of Object.values(raw)) {
    if (entry.s) {
      for (const v of Object.values(entry.s)) {
        stmtTotal += 1
        if (v > 0) stmtCovered += 1
      }
    }
    if (entry.f) {
      for (const v of Object.values(entry.f)) {
        fnTotal += 1
        if (v > 0) fnCovered += 1
      }
    }
    if (entry.b) {
      for (const hits of Object.values(entry.b)) {
        for (const v of hits) {
          branchTotal += 1
          if (v > 0) branchCovered += 1
        }
      }
    }
  }

  return {
    statements: pct(stmtCovered, stmtTotal),
    functions: pct(fnCovered, fnTotal),
    branches: pct(branchCovered, branchTotal),
  }
}

function summarizeServices(filePath) {
  const raw = JSON.parse(readFileSync(filePath, 'utf8'))
  let covered = 0
  let total = 0
  for (const [key, entry] of Object.entries(raw)) {
    if (!key.includes('/services/') || !entry.s) continue
    for (const v of Object.values(entry.s)) {
      total += 1
      if (v > 0) covered += 1
    }
  }
  return total === 0 ? null : pct(covered, total)
}

let failed = false
const rows = []

console.log('M11-S14 Coverage Audit\n')
console.log('| Package | Statements | Functions | Branches | Services | Status |')
console.log('|---------|------------|-----------|----------|----------|--------|')

for (const pkg of PACKAGES) {
  const fullPath = join(ROOT, pkg.path)
  if (!existsSync(fullPath)) {
    console.log(`| ${pkg.name} | — | — | — | — | MISSING |`)
    failed = true
    continue
  }

  const summary = summarize(fullPath)
  const services = summarizeServices(fullPath)
  const overallOk = summary.statements >= (pkg.targets?.overall ?? 80)
  const servicesOk = services == null || services >= (pkg.targets?.services ?? 90)
  const ok = overallOk && servicesOk
  if (!ok) failed = true

  rows.push(
    `| ${pkg.name} | ${summary.statements.toFixed(1)}% | ${summary.functions.toFixed(1)}% | ${summary.branches.toFixed(1)}% | ${services == null ? 'n/a' : `${services.toFixed(1)}%`} | ${ok ? 'PASS' : 'FAIL'} |`,
  )
}

for (const row of rows) console.log(row)

if (failed) {
  console.error('\nCoverage audit FAILED — see targets in testing-strategy.md §11')
  process.exit(1)
}

console.log('\nCoverage audit PASSED')
