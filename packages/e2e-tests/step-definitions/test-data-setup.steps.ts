import { Given } from '@cucumber/cucumber'
import type { IWorld } from './world'

/**
 * Test Data Setup Steps
 *
 * These steps are ONLY for setting up test preconditions (GIVEN).
 * They should NOT be used for assertions (THEN).
 *
 * BDD Principle: Test behavior through the UI/API, not database state.
 */

// ============================================================================
// GIVEN steps - Test data setup (ACCEPTABLE)
// ============================================================================

Given('the database has base test data', async function (this: IWorld) {
  await this.testDb.seedBase()
})

Given('the database has comprehensive test data', async function (this: IWorld) {
  await this.testDb.seedComprehensive()
})

Given(
  'the database is seeded for {string} scenario',
  async function (this: IWorld, scenarioName: string) {
    await this.testDb.seedScenario(scenarioName, {})
  },
)

Given(
  'a test inspector {string} with certifications:',
  async function (this: IWorld, name: string, dataTable) {
    const db = this.testDb.getClient()
    const certifications = dataTable.hashes().map((row: any) => ({
      id: `cert-${Date.now()}-${Math.random()}`,
      name: row.certification,
      designation: row.designation,
      isValid: row.valid === 'true',
      expiryDate: new Date(row.expiryDate).toISOString(),
    }))

    const bcrypt = await import('bcrypt')
    const passwordHash = await bcrypt.hash('Test123!', 10)

    await db.user.create({
      data: {
        email: `${name.toLowerCase().replace(/\s+/g, '.')}@example.com`,
        name,
        role: 'SCO',
        passwordHash,
        certifications,
        disciplines: certifications.map((c: any) => c.name),
        designationId: `TEST-${Date.now()}`,
      },
    })
  },
)

Given(
  'a test permit exists with number {string}',
  async function (this: IWorld, permitNumber: string) {
    // Note: Permit model not yet implemented in current schema
    // This is a placeholder for when the model is added
    console.log(`⚠️  Permit model not yet implemented - skipping permit creation: ${permitNumber}`)
  },
)

Given(
  'an inspection exists for permit {string} assigned to {string}',
  async function (this: IWorld, permitNumber: string, inspectorEmail: string) {
    // Note: Inspection models not yet implemented in current schema
    // This is a placeholder for when the models are added
    console.log(
      `⚠️  Inspection models not yet implemented - skipping inspection creation for: ${permitNumber}`,
    )
  },
)

Given(
  'a deficiency exists for inspection {string}',
  async function (this: IWorld, inspectionClientId: string) {
    // Note: Deficiency model not yet implemented in current schema
    // This is a placeholder for when the model is added
    console.log(`⚠️  Deficiency model not yet implemented - skipping deficiency creation`)
  },
)

// ============================================================================
// NOTE: Database assertions (THEN steps) have been REMOVED
// ============================================================================
//
// Instead of:
//   Then the database should contain a user with email "..."
//
// Use behavior-focused assertions:
//   Then I should see "..." in the user list
//   Then the API should return user "..."
//   Then the admin should see the user in the portal
//
// Database state should be verified through:
// 1. UI assertions (what the user sees)
// 2. API responses (what the system returns)
// 3. Application behavior (how the system acts)
//
// Only use direct database checks for:
// - Debugging failed tests (in step implementation, not as test steps)
// - Verifying async operations that have no UI feedback (rare)
// ============================================================================
