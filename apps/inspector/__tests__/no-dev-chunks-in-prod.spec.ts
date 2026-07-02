import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, extname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const distDir = join(appRoot, 'dist')
const assetsDir = join(distDir, 'assets')
const devOnlyPattern = /AnnotatePhotoE2E|e2e-annotate-photo/i

function collectFiles(dir: string): string[] {
  if (!existsSync(dir)) return []

  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(dir, entry.name)
    return entry.isDirectory() ? collectFiles(entryPath) : [entryPath]
  })
}

const describeProdDist = existsSync(distDir) ? describe : describe.skip

describeProdDist('inspector production bundle hygiene', () => {
  const jsChunks = collectFiles(assetsDir).filter((file) => extname(file) === '.js')

  it('has production JavaScript chunks to inspect', () => {
    expect(jsChunks.length).toBeGreaterThan(0)
  })

  it('does not emit the dev-only annotate photo route chunk', () => {
    const leakedChunkNames = jsChunks
      .map((file) => relative(distDir, file))
      .filter((fileName) => devOnlyPattern.test(fileName))

    expect(leakedChunkNames).toEqual([])
  })

  it('does not include dev-only route markers in JavaScript chunks', () => {
    const leakedChunkContents = jsChunks
      .filter((file) => devOnlyPattern.test(readFileSync(file, 'utf8')))
      .map((file) => relative(distDir, file))

    expect(leakedChunkContents).toEqual([])
  })
})
