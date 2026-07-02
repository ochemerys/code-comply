import type { IWorld } from '../step-definitions/world'

/** Plain JS — must be self-contained for Playwright addInitScript serialization. */
export const GEO_DENY_INIT_SCRIPT = `
(() => {
  navigator.geolocation.getCurrentPosition = function (_success, error) {
    if (error) {
      error({
        code: 1,
        message: 'User denied Geolocation',
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
      })
    }
  }
})()
`

/** Fires a timeout after 9s so E2E can wait 10s and still see the error. */
export const GEO_TIMEOUT_INIT_SCRIPT = `
(() => {
  navigator.geolocation.getCurrentPosition = function (_success, error) {
    setTimeout(function () {
      if (error) {
        error({
          code: 3,
          message: 'Timeout',
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3,
        })
      }
    }, 9000)
  }
})()
`

/** Resolves GPS after 2s at a unique position so vue-query does not serve a cached nearby list. */
export const GEO_SLOW_SUCCESS_LOADING_INIT_SCRIPT = `
(() => {
  navigator.geolocation.getCurrentPosition = function (success, _error, _options) {
    setTimeout(function () {
      if (success) {
        success({
          coords: { latitude: 53.551, longitude: -113.491, accuracy: 1 },
          timestamp: Date.now(),
        })
      }
    }, 2000)
  }
})()
`

export const GEO_UNSUPPORTED_INIT_SCRIPT = `
(() => {
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: {},
  })
})()
`

export const SLOW_NEARBY_FETCH_INIT_SCRIPT = `
(() => {
  const originalFetch = window.fetch.bind(window)
  window.fetch = async function (input, init) {
    const url = typeof input === 'string' ? input : (input && input.url) || ''
    if (url.indexOf('/permits/nearby') !== -1) {
      await new Promise(function (resolve) {
        setTimeout(resolve, 10000)
      })
    }
    return originalFetch(input, init)
  }
})()
`

export async function installGeolocationInitScript(world: IWorld, script: string): Promise<void> {
  await world.context.addInitScript(script)
  await world.page.addInitScript(script)
}

export async function reloadPermitsPage(world: IWorld): Promise<void> {
  await world.page.goto(`${world.getInspectorUrl()}/permits`)
  await world.page.waitForLoadState('networkidle')
  await world.page.getByRole('heading', { name: 'Permits', level: 1 }).waitFor()
}
