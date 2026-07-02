/**
 * Seed data for Permit model (M4-S1)
 *
 * This seed file creates sample permits for testing GPS-based discovery
 * and local search functionality.
 */

import { PrismaClient, PermitStatus } from '@prisma/client'

const prisma = new PrismaClient()

async function seedPermits() {
  console.log('🌱 Seeding permits...')

  // Sample permits with GPS coordinates (Edmonton, Alberta area)
  const permits = [
    {
      permitNumber: 'BP-2024-001',
      address: '10230 Jasper Avenue, Edmonton, AB T5J 4P6',
      legalLandDesc: 'Plan 1234AB Block 5 Lot 12',
      scope: 'New Construction - Single Family Dwelling',
      status: PermitStatus.ACTIVE,
      latitude: 53.5461,
      longitude: -113.4938,
    },
    {
      permitNumber: 'BP-2024-002',
      address: '8882 170 Street NW, Edmonton, AB T5T 4J2',
      legalLandDesc: 'Plan 5678CD Block 2 Lot 8',
      scope: 'Renovation - Kitchen and Bathroom',
      status: PermitStatus.ACTIVE,
      latitude: 53.5232,
      longitude: -113.6289,
    },
    {
      permitNumber: 'BP-2024-003',
      address: '11220 142 Street NW, Edmonton, AB T5M 1V1',
      legalLandDesc: 'Plan 9012EF Block 10 Lot 3',
      scope: 'Addition - Garage',
      status: PermitStatus.ACTIVE,
      latitude: 53.5673,
      longitude: -113.5789,
    },
    {
      permitNumber: 'BP-2024-004',
      address: '10665 Jasper Avenue, Edmonton, AB T5J 3S9',
      legalLandDesc: 'Plan 3456GH Block 7 Lot 15',
      scope: 'Commercial - Office Renovation',
      status: PermitStatus.ACTIVE,
      latitude: 53.5444,
      longitude: -113.4969,
    },
    {
      permitNumber: 'BP-2024-005',
      address: '9930 106 Street NW, Edmonton, AB T5K 1C7',
      legalLandDesc: 'Plan 7890IJ Block 3 Lot 22',
      scope: 'New Construction - Multi-Family Dwelling',
      status: PermitStatus.ACTIVE,
      latitude: 53.5389,
      longitude: -113.4969,
    },
    {
      permitNumber: 'BP-2023-150',
      address: '12345 82 Street NW, Edmonton, AB T5B 2W3',
      legalLandDesc: 'Plan 2468KL Block 12 Lot 5',
      scope: 'Deck Addition',
      status: PermitStatus.COMPLETED,
      latitude: 53.5505,
      longitude: -113.4658,
    },
    {
      permitNumber: 'BP-2024-006',
      address: '10180 101 Street NW, Edmonton, AB T5J 0S4',
      legalLandDesc: 'Plan 1357MN Block 8 Lot 18',
      scope: 'Plumbing - Rough-in Inspection',
      status: PermitStatus.ACTIVE,
      latitude: 53.5444,
      longitude: -113.4909,
    },
    {
      permitNumber: 'BP-2024-007',
      address: '11804 145 Avenue NW, Edmonton, AB T5X 2Y3',
      legalLandDesc: 'Plan 9753OP Block 15 Lot 7',
      scope: 'Electrical - Service Upgrade',
      status: PermitStatus.ACTIVE,
      latitude: 53.6289,
      longitude: -113.5789,
    },
    {
      permitNumber: 'BP-2023-200',
      address: '8215 112 Street NW, Edmonton, AB T6G 1K6',
      legalLandDesc: null, // Some permits may not have legal land description
      scope: 'Fence Installation',
      status: PermitStatus.CANCELLED,
      latitude: 53.5189,
      longitude: -113.5189,
    },
    {
      permitNumber: 'BP-2024-008',
      address: '10123 99 Street NW, Edmonton, AB T5J 0H1',
      legalLandDesc: 'Plan 8642QR Block 20 Lot 11',
      scope: 'Foundation Inspection',
      status: PermitStatus.ACTIVE,
      latitude: 53.5389,
      longitude: -113.4889,
    },
  ]

  for (const permit of permits) {
    await prisma.permit.upsert({
      where: { permitNumber: permit.permitNumber },
      update: permit,
      create: permit,
    })
  }

  console.log(`✅ Seeded ${permits.length} permits`)
}

async function main() {
  try {
    await seedPermits()
  } catch (error) {
    console.error('❌ Error seeding database:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

main()
