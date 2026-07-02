/**
 * Seeds nearby permits in Postgres and loads them into the inspector PWA via Find Near Me.
 */
import { expect } from '@playwright/test'
import type { PrismaClient } from '@prisma/client'
import type { IWorld } from '../step-definitions/world'

const EDMONTON = { latitude: 53.5461, longitude: -113.4938 }

export async function seedNearbyPermitsInDb(
  prisma: PrismaClient,
  count: number,
  options?: { withCoordinates?: boolean; withScheduledInspection?: boolean },
): Promise<string> {
  const inspector = await prisma.user.findUniqueOrThrow({
    where: { email: 'test-inspector@example.com' },
  })
  const stamp = Date.now()
  const performancePermitNumber = `E2E-NEARBY-${stamp}-050`
  for (let i = 0; i < count; i++) {
    const permit = await prisma.permit.create({
      data: {
        permitNumber: `E2E-NEARBY-${stamp}-${String(i + 1).padStart(3, '0')}`,
        address: `${100 + i} Jasper Avenue, Edmonton, AB`,
        scope: 'E2E permit list',
        status: 'ACTIVE',
        latitude: options?.withCoordinates === false ? null : EDMONTON.latitude + i * 0.001,
        longitude: options?.withCoordinates === false ? null : EDMONTON.longitude + i * 0.001,
      },
    })

    if (options?.withScheduledInspection !== false) {
      const scheduledDate = new Date(Date.now() + (i + 1) * 86_400_000)
      const inspection = await prisma.permitInspection.create({
        data: {
          permitId: permit.id,
          scheduledDate,
          status: 'SCHEDULED',
        },
      })
      await prisma.inspectionSchedule.create({
        data: {
          inspectionId: inspection.id,
          assignedToId: inspector.id,
        },
      })
    }
  }
  return count >= 50 ? performancePermitNumber : `E2E-NEARBY-${stamp}-001`
}

export async function expandPermitsToolsPanel(page: IWorld['page']): Promise<void> {
  const toggle = page.getByTestId('permits-tools-toggle')
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') {
    await toggle.click()
  }
}

export async function scrollToPermitListSection(page: IWorld['page']): Promise<void> {
  const section = page.locator('section[aria-label="Your permit list"]')
  await section.scrollIntoViewIfNeeded()
}

export async function loadPermitsViaFindNearMe(this: IWorld): Promise<void> {
  await this.context.grantPermissions(['geolocation'])
  await this.context.setGeolocation(EDMONTON)
  await this.page.goto(`${this.getInspectorUrl()}/permits`)
  await this.page.waitForLoadState('networkidle')
  await this.page.getByRole('button', { name: /Find Near Me/i }).click()
  await expect(this.page.getByTestId('permit-list-cards')).toBeVisible({ timeout: 30000 })
}

export async function seedAndLoadPermitList(
  this: IWorld,
  count = 3,
  options?: { withCoordinates?: boolean },
): Promise<void> {
  await seedNearbyPermitsInDb(this.testDb.getClient(), count, options)
  await loadPermitsViaFindNearMe.call(this)
}
