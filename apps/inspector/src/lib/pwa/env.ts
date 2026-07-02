export const PWA_DEV_ENV_FLAG = 'VITE_ENABLE_PWA_DEV'

const LEGACY_PWA_DEV_ENV_FLAG = ['VITE', 'ENABLE', 'SW', 'DEV'].join('_')

type PwaEnv = Readonly<{
  PROD?: boolean
  DEV?: boolean
  VITE_ENABLE_PWA_DEV?: string
}> &
  Readonly<Record<string, unknown>>

export function isPwaDevEnabled(env: PwaEnv): boolean {
  return env.PROD === true || env.VITE_ENABLE_PWA_DEV === 'true'
}

export function warnIfLegacyPwaDevFlagIsSet(env: PwaEnv): void {
  if (env.DEV !== true || env[LEGACY_PWA_DEV_ENV_FLAG] === '') return
  if (env[LEGACY_PWA_DEV_ENV_FLAG] == null) return

  console.warn(
    `[PWA] ${LEGACY_PWA_DEV_ENV_FLAG} is ignored. Use ${PWA_DEV_ENV_FLAG}=true to enable the service worker in development.`,
  )
}
