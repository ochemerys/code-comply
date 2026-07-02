import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const filePath = path.join(__dirname, '../src/routes/inspections.ts')
let s = fs.readFileSync(filePath, 'utf8')
s = s.replace(/^let app = new OpenAPIHono\(\)\r?\n/m, '')

const matches = [...s.matchAll(/app = app\.openapi\((\w+), async \(c\) => \{/g)]
if (matches.length === 0) {
  console.error('no openapi handlers found')
  process.exit(1)
}

function handlerEnd(s, start) {
  const nextRoute = s.slice(start).search(/\nconst \w+Route = createRoute\(/)
  const nextAssign = s.slice(start).search(/\napp = app\.openapi\(/)
  const exportIdx = s.slice(start).indexOf('\nexport default app')
  const candidates = [nextRoute, nextAssign, exportIdx].filter((i) => i >= 0)
  const delta = candidates.length ? Math.min(...candidates) : s.length - start
  return start + delta
}

const handlers = []
for (let i = 0; i < matches.length; i++) {
  const routeName = matches[i][1]
  const start = matches[i].index + matches[i][0].length
  const end = handlerEnd(s, start)
  let handlerBody = s.slice(start, end).trimEnd()
  if (handlerBody.endsWith('})')) handlerBody = handlerBody.slice(0, -2).trimEnd()
  handlers.push({ routeName, handlerBody })
}

const out = s.slice(0, matches[0].index)
let chain = 'const app = new OpenAPIHono()'
for (const { routeName, handlerBody } of handlers) {
  chain += `\n  .openapi(${routeName}, async (c) => {\n${handlerBody}\n  })`
}
chain += '\n\nexport default app\n'

fs.writeFileSync(filePath, out + chain)
console.log(`chained ${handlers.length} inspection routes`)
