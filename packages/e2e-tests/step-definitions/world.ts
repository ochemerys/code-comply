import { setWorldConstructor, World } from '@cucumber/cucumber'
import { chromium, webkit } from 'playwright'
import type { E2ETestDatabase, TestCredentials } from '../support/test-database'

export interface IWorld extends World {
  browser: any
  context: any
  page: any
  testPorts: {
    api: number
    inspector: number
    admin: number
  }
  testDb: E2ETestDatabase
  testCredentials: TestCredentials
  init(): Promise<void>
  cleanup(): Promise<void>
  getApiUrl(): string
  getInspectorUrl(): string
  getAdminUrl(): string
}

export class CustomWorld extends World implements IWorld {
  browser: any
  context: any
  page: any
  testPorts: {
    api: number
    inspector: number
    admin: number
  }
  testDb!: E2ETestDatabase
  testCredentials!: TestCredentials

  constructor(options: any) {
    super(options)

    // Read ports from environment variables (set by test runner)
    // Defaults use 7000+ range to avoid conflicts with common dev ports
    this.testPorts = {
      api: parseInt(process.env.E2E_API_PORT || '7000'),
      inspector: parseInt(process.env.E2E_INSPECTOR_PORT || '8175'),
      admin: parseInt(process.env.E2E_ADMIN_PORT || '8174'),
    }
  }

  async init(): Promise<void> {
    const browserName = (process.env.E2E_BROWSER || 'chromium').toLowerCase()
    const launcher = browserName === 'webkit' ? webkit : chromium
    this.browser = await launcher.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
      ],
    })
    this.context = await this.browser.newContext({
      viewport: { width: 1280, height: 720 },
    })
    this.page = await this.context.newPage()
  }

  async cleanup(): Promise<void> {
    const browser = this.browser
    this.page = undefined
    this.context = undefined
    this.browser = undefined
    if (!browser) return
    try {
      await Promise.race([
        browser.close(),
        new Promise<void>((resolve) => setTimeout(resolve, 5_000)),
      ])
    } catch {
      /* best-effort teardown for API-only scenarios */
    }
  }

  getApiUrl(): string {
    return process.env.E2E_API_URL || `http://localhost:${this.testPorts.api}`
  }

  getInspectorUrl(): string {
    return process.env.E2E_INSPECTOR_URL || `http://localhost:${this.testPorts.inspector}`
  }

  getAdminUrl(): string {
    return process.env.E2E_ADMIN_URL || `http://localhost:${this.testPorts.admin}`
  }
}

setWorldConstructor(CustomWorld)
