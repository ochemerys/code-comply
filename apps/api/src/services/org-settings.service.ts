import fs from 'node:fs/promises'
import path from 'node:path'
import type {
  AdminSessionPolicy,
  AdminSsoSettings,
  AdminSsoSettingsPatch,
} from '@codecomply/validators'

const DEFAULT_DOC_URL = 'https://openid.net/specs/openid-connect-core-1_0.html'

type PersistedSsoSettings = {
  enabled?: boolean
  issuerUrl?: string
  clientId?: string
  redirectUris?: string[]
}

function settingsFilePath(): string {
  return process.env.ORG_SETTINGS_PATH ?? path.join(process.cwd(), 'data', 'org-settings.json')
}

function parseRedirectUrisFromEnv(): string[] {
  const raw = process.env.SSO_REDIRECT_URIS?.trim()
  if (!raw) return []
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

async function readPersisted(): Promise<PersistedSsoSettings> {
  try {
    const raw = await fs.readFile(settingsFilePath(), 'utf8')
    return JSON.parse(raw) as PersistedSsoSettings
  } catch {
    return {}
  }
}

async function writePersisted(patch: PersistedSsoSettings): Promise<void> {
  const file = settingsFilePath()
  await fs.mkdir(path.dirname(file), { recursive: true })
  const current = await readPersisted()
  await fs.writeFile(file, JSON.stringify({ ...current, ...patch }, null, 2), 'utf8')
}

function parseIdleMinutes(raw: string | undefined, fallback: number): number {
  if (!raw?.trim()) return fallback
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

export class OrgSettingsService {
  async getSsoSettings(): Promise<AdminSsoSettings> {
    const persisted = await readPersisted()
    const redirectUris = persisted.redirectUris?.length
      ? persisted.redirectUris
      : parseRedirectUrisFromEnv()

    return {
      enabled: persisted.enabled ?? process.env.SSO_ENABLED === 'true',
      issuerUrl: persisted.issuerUrl ?? process.env.SSO_ISSUER_URL ?? '',
      clientId: persisted.clientId ?? process.env.SSO_CLIENT_ID ?? '',
      redirectUris,
      clientSecretConfigured: Boolean(process.env.SSO_CLIENT_SECRET?.trim()),
      documentationUrl: process.env.SSO_DOCUMENTATION_URL ?? DEFAULT_DOC_URL,
    }
  }

  async patchSsoSettings(patch: AdminSsoSettingsPatch): Promise<AdminSsoSettings> {
    const toSave: PersistedSsoSettings = {}
    if (patch.enabled !== undefined) toSave.enabled = patch.enabled
    if (patch.issuerUrl !== undefined) toSave.issuerUrl = patch.issuerUrl
    if (patch.clientId !== undefined) toSave.clientId = patch.clientId
    if (patch.redirectUris !== undefined) toSave.redirectUris = patch.redirectUris
    await writePersisted(toSave)
    return this.getSsoSettings()
  }

  getSessionPolicy(): AdminSessionPolicy {
    const warnMin = parseIdleMinutes(process.env.ADMIN_IDLE_WARN_MINUTES, 14)
    const logoutMin = parseIdleMinutes(process.env.ADMIN_IDLE_LOGOUT_MINUTES, 15)
    const hasServerPolicy =
      process.env.ADMIN_IDLE_WARN_MINUTES !== undefined ||
      process.env.ADMIN_IDLE_LOGOUT_MINUTES !== undefined

    return {
      idleWarnAfterMinutes: warnMin,
      idleLogoutAfterMinutes: logoutMin > warnMin ? logoutMin : warnMin + 1,
      source: hasServerPolicy ? 'server' : 'client',
    }
  }
}

export const orgSettingsService = new OrgSettingsService()
