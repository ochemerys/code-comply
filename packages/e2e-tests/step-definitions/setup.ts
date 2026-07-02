import { Before, After, BeforeAll, AfterAll, setDefaultTimeout } from '@cucumber/cucumber'
import type { IWorld } from './world'
import { getTestDatabase } from '../support/test-database'

// Set default timeout for all steps
setDefaultTimeout(30000)

// Database instance
const testDb = getTestDatabase()

BeforeAll(async function () {
  // Global setup before all tests
  console.log('🚀 Starting E2E test suite...')

  // Initialize database connection
  await testDb.initialize()

  // Clean and seed base data
  console.log('🔄 Preparing test database...')
  await testDb.reset()

  console.log('✅ Test suite ready\n')
})

AfterAll(async function () {
  // Global teardown after all tests
  console.log('\n🏁 E2E test suite completed')

  // Disconnect from database
  await testDb.disconnect()
})

Before({ order: 0 }, async function (this: IWorld, { pickle }) {
  // Initialize browser context for each scenario
  if (!this.browser) {
    await this.init()
  }

  // Make database available to scenarios
  this.testDb = testDb
  this.testCredentials = testDb.getTestCredentials()

  // Log scenario start
  if (process.env.DEBUG) {
    console.log(`\n📝 Scenario: ${pickle.name}`)
  }
})

After(async function (this: IWorld, { pickle, result }) {
  // Cleanup browser context after each scenario
  await this.cleanup()

  // Log scenario result
  if (process.env.DEBUG) {
    const status = result?.status || 'UNKNOWN'
    const emoji = status === 'PASSED' ? '✅' : status === 'FAILED' ? '❌' : '⚠️'
    console.log(`${emoji} Scenario ${status}: ${pickle.name}\n`)
  }

  // Optional: Reset database between scenarios for complete isolation
  // Uncomment if you want each scenario to start with a clean slate
  // await testDb.reset()
})
