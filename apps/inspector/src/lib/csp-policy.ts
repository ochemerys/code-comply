/**
 * Content-Security-Policy for the Inspector SPA shell (NFR-M-03).
 * Injected into index.html at dev/build time; mirrors API security middleware directives.
 */

export type InspectorCspDirectiveName =
  | 'default-src'
  | 'script-src'
  | 'style-src'
  | 'img-src'
  | 'connect-src'
  | 'worker-src'
  | 'object-src'
  | 'frame-ancestors'
  | 'base-uri'
  | 'form-action'

export type InspectorCspDirectives = Record<InspectorCspDirectiveName, string>

const INSPECTOR_CSP_DIRECTIVE_ORDER: InspectorCspDirectiveName[] = [
  'default-src',
  'script-src',
  'style-src',
  'img-src',
  'connect-src',
  'worker-src',
  'object-src',
  'frame-ancestors',
  'base-uri',
  'form-action',
]

/** Baseline SPA directives aligned with apps/api/src/middleware/security.ts. */
export const DEFAULT_INSPECTOR_CSP_DIRECTIVES: InspectorCspDirectives = {
  'default-src': "'self'",
  'script-src': "'self'",
  'style-src': "'self' 'unsafe-inline'",
  'img-src': "'self' data: blob:",
  'connect-src': "'self'",
  'worker-src': "'self' blob:",
  'object-src': "'none'",
  'frame-ancestors': "'none'",
  'base-uri': "'self'",
  'form-action': "'self'",
}

function parseExtraConnectSources(raw: string | undefined): string[] {
  const extra = raw?.trim()
  if (!extra) return []
  return extra.split(/\s+/).filter(Boolean)
}

/** Build connect-src for the PWA (API origin, Sentry, dev HMR). */
export function buildInspectorConnectSrc(options?: {
  apiUrl?: string
  sentryDsn?: string
  extra?: string
}): string {
  const sources = new Set(
    DEFAULT_INSPECTOR_CSP_DIRECTIVES['connect-src'].split(/\s+/).filter(Boolean),
  )

  for (const url of parseExtraConnectSources(options?.extra)) {
    sources.add(url)
  }

  const apiUrl = options?.apiUrl?.trim()
  if (apiUrl) sources.add(apiUrl)

  // Vite dev proxy / local API when env points at default localhost:4000.
  sources.add('http://localhost:4000')
  sources.add('http://127.0.0.1:4000')
  sources.add('ws:')
  sources.add('wss:')

  const sentryDsn = options?.sentryDsn?.trim()
  if (sentryDsn) {
    try {
      sources.add(new URL(sentryDsn).origin)
    } catch {
      // ignore invalid DSN at build time
    }
  }

  return [...sources].join(' ')
}

export function resolveInspectorCspDirectives(options?: {
  apiUrl?: string
  sentryDsn?: string
  extraConnectSrc?: string
}): InspectorCspDirectives {
  return {
    ...DEFAULT_INSPECTOR_CSP_DIRECTIVES,
    'connect-src': buildInspectorConnectSrc({
      apiUrl: options?.apiUrl,
      sentryDsn: options?.sentryDsn,
      extra: options?.extraConnectSrc,
    }),
  }
}

/** Serialize directives into a CSP meta tag `content` value. */
export function formatInspectorCspContent(directives?: InspectorCspDirectives): string {
  const resolved = directives ?? resolveInspectorCspDirectives()
  return INSPECTOR_CSP_DIRECTIVE_ORDER.map((name) => `${name} ${resolved[name]}`).join('; ')
}

const CSP_META_PLACEHOLDER = '<!-- INSPECTOR_CSP_META -->'

/** Inject (or replace) the CSP meta tag in index.html. */
export function injectCspMetaIntoHtml(html: string, content: string): string {
  const meta = `<meta http-equiv="Content-Security-Policy" content="${content}" />`
  if (html.includes(CSP_META_PLACEHOLDER)) {
    return html.replace(CSP_META_PLACEHOLDER, meta)
  }
  if (html.includes('http-equiv="Content-Security-Policy"')) {
    return html.replace(/<meta\s+http-equiv="Content-Security-Policy"[^>]*>/, meta)
  }
  return html.replace('</head>', `    ${meta}\n  </head>`)
}

export { CSP_META_PLACEHOLDER }
