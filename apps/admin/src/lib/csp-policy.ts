/**
 * Content-Security-Policy for the Admin SPA shell (NFR-A-01).
 * Injected into index.html at dev/build time; aligned with API security middleware.
 */

export type AdminCspDirectiveName =
  | 'default-src'
  | 'script-src'
  | 'style-src'
  | 'font-src'
  | 'img-src'
  | 'connect-src'
  | 'object-src'
  | 'frame-ancestors'
  | 'base-uri'
  | 'form-action'

export type AdminCspDirectives = Record<AdminCspDirectiveName, string>

const ADMIN_CSP_DIRECTIVE_ORDER: AdminCspDirectiveName[] = [
  'default-src',
  'script-src',
  'style-src',
  'font-src',
  'img-src',
  'connect-src',
  'object-src',
  'frame-ancestors',
  'base-uri',
  'form-action',
]

/**
 * Directives that browsers ignore (and warn about) when delivered via a
 * `<meta http-equiv>` tag. They are only enforced when sent as an HTTP
 * response header, so they are excluded from the meta payload and emitted as
 * headers by the dev/preview server (see vite.config.ts).
 */
export const META_INCOMPATIBLE_ADMIN_CSP_DIRECTIVES: readonly AdminCspDirectiveName[] = [
  'frame-ancestors',
]

/** Baseline SPA directives aligned with apps/api/src/middleware/security.ts. */
export const DEFAULT_ADMIN_CSP_DIRECTIVES: AdminCspDirectives = {
  'default-src': "'self'",
  'script-src': "'self'",
  'style-src': "'self' 'unsafe-inline'",
  /** FullCalendar ships fcicons as an inline data: font (workload calendar). */
  'font-src': "'self' data:",
  'img-src': "'self' data: blob:",
  'connect-src': "'self'",
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

/** Vite dev/HMR needs inline scripts; production stays strict. */
export function buildAdminScriptSrc(isDev?: boolean): string {
  return isDev ? "'self' 'unsafe-inline'" : "'self'"
}

/** Build connect-src for the admin portal (API origin, Sentry, dev HMR). */
export function buildAdminConnectSrc(options?: {
  apiUrl?: string
  sentryDsn?: string
  extra?: string
  isDev?: boolean
}): string {
  const sources = new Set(DEFAULT_ADMIN_CSP_DIRECTIVES['connect-src'].split(/\s+/).filter(Boolean))

  for (const url of parseExtraConnectSources(options?.extra)) {
    sources.add(url)
  }

  const apiUrl = options?.apiUrl?.trim()
  if (apiUrl) sources.add(apiUrl)

  sources.add('http://localhost:4000')
  sources.add('http://127.0.0.1:4000')

  if (options?.isDev) {
    sources.add('ws:')
    sources.add('wss:')
  }

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

export function resolveAdminCspDirectives(options?: {
  apiUrl?: string
  sentryDsn?: string
  extraConnectSrc?: string
  isDev?: boolean
}): AdminCspDirectives {
  return {
    ...DEFAULT_ADMIN_CSP_DIRECTIVES,
    'script-src': buildAdminScriptSrc(options?.isDev),
    'connect-src': buildAdminConnectSrc({
      apiUrl: options?.apiUrl,
      sentryDsn: options?.sentryDsn,
      extra: options?.extraConnectSrc,
      isDev: options?.isDev,
    }),
  }
}

/** Serialize directives into a full CSP value (e.g. for an HTTP response header). */
export function formatAdminCspHeaderContent(directives?: AdminCspDirectives): string {
  const resolved = directives ?? resolveAdminCspDirectives()
  return ADMIN_CSP_DIRECTIVE_ORDER.map((name) => `${name} ${resolved[name]}`).join('; ')
}

/**
 * Serialize directives into a `<meta http-equiv>`-safe CSP value.
 * Omits directives that browsers ignore when delivered via meta
 * (e.g. `frame-ancestors`) to avoid the console warning.
 */
export function formatAdminCspContent(directives?: AdminCspDirectives): string {
  const resolved = directives ?? resolveAdminCspDirectives()
  return ADMIN_CSP_DIRECTIVE_ORDER.filter(
    (name) => !META_INCOMPATIBLE_ADMIN_CSP_DIRECTIVES.includes(name),
  )
    .map((name) => `${name} ${resolved[name]}`)
    .join('; ')
}

const CSP_META_PLACEHOLDER = '<!-- ADMIN_CSP_META -->'

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
