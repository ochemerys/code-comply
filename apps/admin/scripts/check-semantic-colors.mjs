#!/usr/bin/env node
/**
 * Fails when admin Vue/TS source uses raw Tailwind gray/slate/blue palette
 * utilities instead of the @codecomply/ui semantic tokens
 * (responsive-design-guide.md §5 "Color & Semantic Tokens").
 *
 * Mirror of apps/inspector/scripts/check-view-semantic-colors.mjs, widened to
 * the whole admin src tree. See apps/admin/README.md for the token mapping.
 */
import { readdir, readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const srcDir = join(dirname(fileURLToPath(import.meta.url)), '../src')
const rawColorPattern =
  /\b(?:bg|text|border|ring|from|to|via|divide|outline|decoration|placeholder|stroke|fill|accent)-(?:gray|slate|blue)-\d+/g

async function collectFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(full)))
    } else if (entry.name.endsWith('.vue') || entry.name.endsWith('.ts')) {
      files.push(full)
    }
  }
  return files
}

const files = await collectFiles(srcDir)
const violations = []

for (const path of files) {
  const content = await readFile(path, 'utf8')
  const matches = content.match(rawColorPattern)
  if (matches?.length) {
    violations.push({ path, matches: [...new Set(matches)] })
  }
}

if (violations.length > 0) {
  console.error('Raw Tailwind palette utilities found (use @codecomply/ui semantic tokens instead):\n')
  for (const { path, matches } of violations) {
    console.error(`  ${path}: ${matches.join(', ')}`)
  }
  process.exit(1)
}

console.log(`Semantic color check passed (${files.length} source files).`)
