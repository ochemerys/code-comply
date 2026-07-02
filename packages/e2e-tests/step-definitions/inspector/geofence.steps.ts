/**
 * E2E step definitions for Geofence Warning (M4-S8)
 *
 * Geofence scenario requires permit detail page with GeofenceWarning component.
 * Steps assert "Outside Inspection Area" and optional audit notification.
 */
import { Given, When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import type { IWorld } from '../world'

// "I am on the permits page" is defined in permits.steps.ts (shared navigation).

Given(
  'the permit has a geofence radius of {int}m',
  async function (this: IWorld, radiusMeters: number) {
    ;(this as any).geofenceRadiusMeters = radiusMeters
  },
)

When(
  'I am more than {int}m away from the permit location',
  async function (this: IWorld, distanceMeters: number) {
    // Grant geolocation with a position far from permit (permit detail page must be open).
    // Permit location is typically the one shown on detail view; we use a fixed far position.
    const farPosition = { latitude: 51.05, longitude: -114.08 }
    await this.context?.grantPermissions(['geolocation'])
    await this.context?.setGeolocation(farPosition)
  },
)

Then('I should see a geofence warning', async function (this: IWorld) {
  await expect(this.page.getByRole('alert')).toContainText('Outside Inspection Area')
})

Then('I should be notified that I am outside the inspection area', async function (this: IWorld) {
  await expect(this.page.locator('.geofence-warning')).toContainText('from the permit location')
})
