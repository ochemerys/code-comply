#!/usr/bin/env node
/**
 * acme/no-handrolled-modal-overlay
 *
 * Fails when inspector code reintroduces modal shells that should go through
 * @codecomply/ui's BottomSheet primitive.
 */
import { readdir, readFile } from 'node:fs/promises'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '../src')
const handrolledOverlayPatterns = [
  /\bfixed\s+inset-0\b/,
  /\bitems-end\b[^\n"]*\btablet:items-center\b/,
  /\btablet:items-center\b[^\n"]*\bitems-end\b/,
]

async function collectVueAndTsFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await collectVueAndTsFiles(path)))
    } else if (/\.(vue|ts)$/.test(entry.name) && !/\.(spec|test)\.ts$/.test(entry.name)) {
      files.push(path)
    }
  }

  return files
}

const violations = []

for (const file of await collectVueAndTsFiles(rootDir)) {
  const content = await readFile(file, 'utf8')
  const lines = content.split('\n')

  lines.forEach((line, index) => {
    if (handrolledOverlayPatterns.some((pattern) => pattern.test(line))) {
      violations.push({
        file: relative(rootDir, file),
        line: index + 1,
        content: line.trim(),
      })
    }
  })
}

if (violations.length > 0) {
  console.error('acme/no-handrolled-modal-overlay violations found:\n')
  for (const violation of violations) {
    console.error(`  ${violation.file}:${violation.line} ${violation.content}`)
  }
  console.error('\nUse @codecomply/ui BottomSheet for inspector modal and sheet shells.')
  process.exit(1)
}

console.log('Modal overlay check passed.')
