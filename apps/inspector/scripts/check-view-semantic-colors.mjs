#!/usr/bin/env node
/**
 * Fails when view-level Vue files use raw Tailwind gray/slate/blue palette utilities
 * instead of semantic tokens (mobile-first-design-guide.md §4.1).
 */
import { readdir, readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const viewsDir = join(dirname(fileURLToPath(import.meta.url)), '../src/views')
const rawColorPattern =
  /\b(?:bg|text|border|ring|from|to|via|divide|outline|decoration|placeholder|stroke|fill|accent)-(?:gray|slate|blue)-\d+/g

const files = (await readdir(viewsDir)).filter((name) => name.endsWith('.vue'))
const violations = []

for (const file of files) {
  const path = join(viewsDir, file)
  const content = await readFile(path, 'utf8')
  const matches = content.match(rawColorPattern)
  if (matches?.length) {
    violations.push({ file, matches: [...new Set(matches)] })
  }
}

if (violations.length > 0) {
  console.error('Raw Tailwind palette utilities found in views (use semantic tokens instead):\n')
  for (const { file, matches } of violations) {
    console.error(`  ${file}: ${matches.join(', ')}`)
  }
  process.exit(1)
}

console.log(`Semantic color check passed (${files.length} view files).`)
