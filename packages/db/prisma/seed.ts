/* eslint-disable no-console */
import { PrismaClient, type PermitInspection } from '@prisma/client'
import * as bcrypt from 'bcrypt'
import {
  agencyPermitsForSeed,
  buildMunicipalPermitFeed,
} from './seeds/municipal-permit-feed.seed.js'
import {
  ASSIGNMENT_INACTIVE_SCO,
  ASSIGNMENT_NEAR_MAX_DATE,
  ASSIGNMENT_NEAR_MAX_PERMIT_NUMBERS,
  ASSIGNMENT_PREPARED_PERMIT,
  ASSIGNMENT_SUBDIVISION_PERMITS,
  ASSIGNMENT_VERIFICATION_SCO,
} from './seeds/assignment-verification.seed.js'
import { TRIAGE_STOP_WORK_PERMIT_NUMBER, TRIAGE_TEST_PERMITS } from './seeds/triage-permits.seed.js'
import { FIELD_ASSIGNED_PERMIT } from './seeds/field-verification.seed.js'
import { ESCALATION_UNABLE_TO_ENTER_PERMIT } from './seeds/escalation-verification.seed.js'
import {
  APPROVE_GARAGE_DEFICIENCY,
  APPROVE_VERIFICATION_PERMIT,
} from './seeds/approve-verification.seed.js'

const prisma = new PrismaClient() as PrismaClient & {
  photo: { deleteMany: (args?: { where?: object }) => Promise<unknown> }
}

async function main() {
  console.log('🌱 Seeding database...')

  // Clean existing data in dependency order (so FK constraints are satisfied)
  try {
    await prisma.photo.deleteMany()
    await prisma.deficiency.deleteMany()
    await prisma.checklistExecution.deleteMany()
    await prisma.checklistTemplate.deleteMany()
    await prisma.codeLibrary.deleteMany()
    await prisma.inspectionSchedule.deleteMany()
    await prisma.inspectionWorkflow.deleteMany()
    await prisma.session.deleteMany()
    await prisma.permitInspection.deleteMany()
    await prisma.municipalPermitFeedEntry.deleteMany()
    await prisma.permit.deleteMany()
    await prisma.user.deleteMany()
    console.log('🧹 Cleaned existing data')
  } catch (error) {
    console.log('ℹ️  No existing data to clean (fresh database)', (error as Error).message)
  }

  // Hash passwords for development users
  const adminPassword = await bcrypt.hash('admin123', 10)
  const inspectorPassword = await bcrypt.hash('password123', 10)
  const ownerPassword = await bcrypt.hash('owner123', 10)

  // Create development users with passwords
  const admin = await prisma.user.create({
    data: {
      email: 'admin@example.com',
      name: 'Admin User',
      role: 'ADMIN',
      passwordHash: adminPassword,
      certifications: [
        {
          id: 'cert-admin-1',
          name: 'Administrative Certification',
          designation: 'ADMIN-CERT',
          isValid: true,
          expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year from now
        },
      ],
      disciplines: ['Administration', 'Management'],
    },
  })

  const inspector1 = await prisma.user.create({
    data: {
      email: 'inspector1@example.com',
      name: 'Jane Smith',
      role: 'SCO',
      passwordHash: inspectorPassword,
      certifications: [
        {
          id: 'cert-insp1-1',
          name: 'Building Code Certification',
          designation: 'SCO-BC',
          isValid: true,
          expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: 'cert-insp1-2',
          name: 'Electrical Safety Certification',
          designation: 'SCO-ES',
          isValid: true,
          expiryDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(), // 6 months
        },
      ],
      disciplines: ['Building', 'Electrical'],
      designationId: 'SCO-001',
    },
  })

  const inspector2 = await prisma.user.create({
    data: {
      email: 'inspector2@example.com',
      name: 'John Doe',
      role: 'SCO',
      passwordHash: inspectorPassword,
      certifications: [
        {
          id: 'cert-insp2-1',
          name: 'Plumbing Safety Certification',
          designation: 'SCO-PS',
          isValid: true,
          expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        },
      ],
      disciplines: ['Plumbing', 'Gas'],
      designationId: 'SCO-002',
    },
  })

  const owner = await prisma.user.create({
    data: {
      email: 'owner@example.com',
      name: 'Property Owner',
      role: 'OWNER',
      passwordHash: ownerPassword,
      certifications: [],
      disciplines: [],
    },
  })

  const patNguyen = await prisma.user.create({
    data: {
      email: ASSIGNMENT_VERIFICATION_SCO.email,
      name: ASSIGNMENT_VERIFICATION_SCO.name,
      role: 'SCO',
      passwordHash: inspectorPassword,
      designationId: ASSIGNMENT_VERIFICATION_SCO.designationId,
      disciplines: [...ASSIGNMENT_VERIFICATION_SCO.disciplines],
      authorities: [...ASSIGNMENT_VERIFICATION_SCO.authorities],
      certificationExpiry: new Date(ASSIGNMENT_VERIFICATION_SCO.certificationExpiry),
      certifications: [
        {
          id: 'cert-pat-building',
          name: 'Building Code Certification',
          designation: 'SCO-BC',
          isValid: true,
          expiryDate: ASSIGNMENT_VERIFICATION_SCO.certificationExpiry,
        },
      ],
    },
  })

  const jordanBlake = await prisma.user.create({
    data: {
      email: ASSIGNMENT_INACTIVE_SCO.email,
      name: ASSIGNMENT_INACTIVE_SCO.name,
      role: 'SCO',
      passwordHash: inspectorPassword,
      designationId: ASSIGNMENT_INACTIVE_SCO.designationId,
      disciplines: [...ASSIGNMENT_INACTIVE_SCO.disciplines],
      authorities: [...ASSIGNMENT_INACTIVE_SCO.authorities],
      isActive: false,
      deactivatedAt: new Date('2026-01-15T09:00:00.000Z'),
      certifications: [],
    },
  })

  console.log('✅ Users created:')
  console.log(`  - Admin: ${admin.email} (${admin.id})`)
  console.log(`    Password: admin123`)
  console.log(`  - Inspector 1: ${inspector1.email} (${inspector1.id})`)
  console.log(`    Password: password123`)
  console.log(`  - Inspector 2: ${inspector2.email} (${inspector2.id})`)
  console.log(`    Password: password123`)
  console.log(`  - Pat Nguyen (VC-ASSIGN): ${patNguyen.email} (${patNguyen.id})`)
  console.log(`    Password: password123`)
  console.log(`  - Jordan Blake (inactive, VC-ASSIGN-04): ${jordanBlake.email} (${jordanBlake.id})`)
  console.log(`  - Owner: ${owner.email} (${owner.id})`)
  console.log(`    Password: owner123`)
  console.log('')

  // Seed Permits (M4-S1)
  console.log('🌱 Seeding permits...')

  const permits = [
    {
      permitNumber: 'BP-2024-001',
      address: '10230 Jasper Avenue, Edmonton, AB T5J 4P6',
      legalLandDesc: 'Plan 1234AB Block 5 Lot 12',
      scope: 'New Construction - Single Family Dwelling',
      status: 'ACTIVE' as const,
      latitude: 53.5461,
      longitude: -113.4938,
    },
    {
      permitNumber: 'BP-2024-002',
      address: '8882 170 Street NW, Edmonton, AB T5T 4J2',
      legalLandDesc: 'Plan 5678CD Block 2 Lot 8',
      scope: 'Renovation - Kitchen and Bathroom',
      status: 'ACTIVE' as const,
      latitude: 53.5232,
      longitude: -113.6289,
    },
    {
      permitNumber: 'BP-2024-003',
      address: '11220 142 Street NW, Edmonton, AB T5M 1V1',
      legalLandDesc: 'Plan 9012EF Block 10 Lot 3',
      scope: 'Addition - Garage',
      status: 'ACTIVE' as const,
      latitude: 53.5673,
      longitude: -113.5789,
    },
    {
      permitNumber: 'BP-2024-004',
      address: '10665 Jasper Avenue, Edmonton, AB T5J 3S9',
      legalLandDesc: 'Plan 3456GH Block 7 Lot 15',
      scope: 'Commercial - Office Renovation',
      status: 'ACTIVE' as const,
      latitude: 53.5444,
      longitude: -113.4969,
    },
    {
      permitNumber: 'BP-2024-005',
      address: '9930 106 Street NW, Edmonton, AB T5K 1C7',
      legalLandDesc: 'Plan 7890IJ Block 3 Lot 22',
      scope: 'New Construction - Multi-Family Dwelling',
      status: 'ACTIVE' as const,
      latitude: 53.5389,
      longitude: -113.4969,
    },
    {
      permitNumber: 'BP-2023-150',
      address: '12345 82 Street NW, Edmonton, AB T5B 2W3',
      legalLandDesc: 'Plan 2468KL Block 12 Lot 5',
      scope: 'Deck Addition',
      status: 'COMPLETED' as const,
      latitude: 53.5505,
      longitude: -113.4658,
    },
    {
      permitNumber: 'BP-2024-006',
      address: '10180 101 Street NW, Edmonton, AB T5J 0S4',
      legalLandDesc: 'Plan 1357MN Block 8 Lot 18',
      scope: 'Plumbing - Rough-in Inspection',
      status: 'ACTIVE' as const,
      latitude: 53.5444,
      longitude: -113.4909,
    },
    {
      permitNumber: 'BP-2024-007',
      address: '11804 145 Avenue NW, Edmonton, AB T5X 2Y3',
      legalLandDesc: 'Plan 9753OP Block 15 Lot 7',
      scope: 'Electrical - Service Upgrade',
      status: 'ACTIVE' as const,
      latitude: 53.6289,
      longitude: -113.5789,
    },
    {
      permitNumber: 'BP-2023-200',
      address: '8215 112 Street NW, Edmonton, AB T6G 1K6',
      legalLandDesc: null,
      scope: 'Fence Installation',
      status: 'CANCELLED' as const,
      latitude: 53.5189,
      longitude: -113.5189,
    },
    {
      permitNumber: 'BP-2024-008',
      address: '10123 99 Street NW, Edmonton, AB T5J 0H1',
      legalLandDesc: 'Plan 8642QR Block 20 Lot 11',
      scope: 'Foundation Inspection',
      status: 'ACTIVE' as const,
      latitude: 53.5389,
      longitude: -113.4889,
    },
    // Dartmouth, Nova Scotia
    {
      permitNumber: 'BP-2024-NS-001',
      address: '45 Portland Street, Dartmouth, NS B2Y 1H6',
      legalLandDesc: 'PID 00123456',
      scope: 'New Construction - Single Family Dwelling',
      status: 'ACTIVE' as const,
      latitude: 44.6692,
      longitude: -63.5714,
    },
    {
      permitNumber: 'BP-2024-NS-002',
      address: '88 Alderney Drive, Dartmouth, NS B2Y 2N6',
      legalLandDesc: 'PID 00123457',
      scope: 'Commercial - Retail Renovation',
      status: 'ACTIVE' as const,
      latitude: 44.6653,
      longitude: -63.5672,
    },
    {
      permitNumber: 'BP-2024-NS-003',
      address: '120 Wyse Road, Dartmouth, NS B3A 1M2',
      legalLandDesc: 'PID 00123458',
      scope: 'Addition - Second Storey',
      status: 'ACTIVE' as const,
      latitude: 44.6721,
      longitude: -63.5823,
    },
    {
      permitNumber: 'BP-2023-NS-050',
      address: '256 Windmill Road, Dartmouth, NS B3A 4B5',
      legalLandDesc: 'PID 00123459',
      scope: 'Electrical - Panel Upgrade',
      status: 'COMPLETED' as const,
      latitude: 44.6589,
      longitude: -63.5541,
    },
    // Sydney / Howie Centre, NS (Floral Heights area, B1L 1G9) – near 120 Floral Heights Dr
    {
      permitNumber: 'BP-2024-CB-001',
      address: '120 Floral Heights Dr, Sydney, NS B1L 1G9',
      legalLandDesc: 'PID 12345678',
      scope: 'New Construction - Single Family Dwelling',
      status: 'ACTIVE' as const,
      latitude: 46.138,
      longitude: -60.192,
    },
    {
      permitNumber: 'BP-2024-CB-002',
      address: '95 Floral Heights Dr, Howie Centre, NS B1L 1G9',
      legalLandDesc: 'PID 12345679',
      scope: 'Renovation - Kitchen and Bathroom',
      status: 'ACTIVE' as const,
      latitude: 46.1372,
      longitude: -60.1915,
    },
    {
      permitNumber: 'BP-2024-CB-003',
      address: '145 Floral Heights Dr, Sydney, NS B1L 1G9',
      legalLandDesc: 'PID 12345680',
      scope: 'Addition - Deck',
      status: 'ACTIVE' as const,
      latitude: 46.1388,
      longitude: -60.1928,
    },
    {
      permitNumber: 'BP-2023-CB-010',
      address: '80 Floral Heights Dr, Howie Centre, NS B1L 1G9',
      legalLandDesc: 'PID 12345681',
      scope: 'Electrical - Service Upgrade',
      status: 'COMPLETED' as const,
      latitude: 46.1365,
      longitude: -60.1908,
    },
    {
      permitNumber: 'BP-2024-CB-004',
      address: '168 Grand Lake Rd, Sydney, NS B1L 1A1',
      legalLandDesc: 'PID 12345682',
      scope: 'Plumbing - Rough-in Inspection',
      status: 'ACTIVE' as const,
      latitude: 46.1395,
      longitude: -60.1935,
    },
    // Near 46.0683, -60.2669 (Cape Breton – within 20 km radius of common GPS at this location)
    {
      permitNumber: 'BP-2024-CB-005',
      address: '245 Westmount Rd, Sydney, NS B1P 5G5',
      legalLandDesc: 'PID 12345683',
      scope: 'New Construction - Single Family',
      status: 'ACTIVE' as const,
      latitude: 46.0683,
      longitude: -60.2669,
    },
    {
      permitNumber: 'BP-2024-CB-006',
      address: '180 Westmount Rd, Sydney, NS B1P 5G2',
      legalLandDesc: 'PID 12345684',
      scope: 'Renovation - Basement',
      status: 'ACTIVE' as const,
      latitude: 46.0688,
      longitude: -60.2672,
    },
    {
      permitNumber: 'BP-2023-CB-020',
      address: '310 Westmount Rd, Sydney, NS B1P 5G8',
      legalLandDesc: 'PID 12345685',
      scope: 'Electrical - Panel Upgrade',
      status: 'COMPLETED' as const,
      latitude: 46.0679,
      longitude: -60.2665,
    },
    // Northern Saskatchewan (e.g. La Ronge area) – within ~20 km of 56.13°N, 106.35°W
    {
      permitNumber: 'BP-2024-SK-001',
      address: 'Highway 2 North, La Ronge, SK S0J 1L0',
      legalLandDesc: 'SW-36-65-26-W2',
      scope: 'New Construction - Single Family Dwelling',
      status: 'ACTIVE' as const,
      latitude: 56.1289,
      longitude: -106.3421,
    },
    {
      permitNumber: 'BP-2024-SK-002',
      address: 'Lac La Ronge Road, Saskatchewan',
      legalLandDesc: 'NE-12-65-26-W2',
      scope: 'Addition - Garage',
      status: 'ACTIVE' as const,
      latitude: 56.1422,
      longitude: -106.3689,
    },
    {
      permitNumber: 'BP-2024-SK-003',
      address: 'Airport Road, La Ronge, SK S0J 1L0',
      legalLandDesc: 'SE-34-65-27-W2',
      scope: 'Electrical - Service Upgrade',
      status: 'ACTIVE' as const,
      latitude: 56.1189,
      longitude: -106.3312,
    },
    {
      permitNumber: 'BP-2024-SK-004',
      address: 'Churchill Drive, La Ronge, SK S0J 1L0',
      legalLandDesc: 'NW-18-65-26-W2',
      scope: 'Renovation - Kitchen and Bathroom',
      status: 'ACTIVE' as const,
      latitude: 56.1355,
      longitude: -106.3555,
    },
    {
      permitNumber: 'BP-2023-SK-020',
      address: 'Larsen Bay Road, Saskatchewan',
      legalLandDesc: 'SW-22-65-27-W2',
      scope: 'Deck Addition',
      status: 'COMPLETED' as const,
      latitude: 56.1222,
      longitude: -106.3789,
    },
    ...TRIAGE_TEST_PERMITS,
    {
      permitNumber: FIELD_ASSIGNED_PERMIT.permitNumber,
      address: FIELD_ASSIGNED_PERMIT.address,
      legalLandDesc: FIELD_ASSIGNED_PERMIT.legalLandDesc,
      scope: FIELD_ASSIGNED_PERMIT.scope,
      status: 'ACTIVE' as const,
      latitude: FIELD_ASSIGNED_PERMIT.latitude,
      longitude: FIELD_ASSIGNED_PERMIT.longitude,
    },
    ...ASSIGNMENT_SUBDIVISION_PERMITS.map((p) => ({
      permitNumber: p.permitNumber,
      address: p.address,
      legalLandDesc: p.legalLandDesc,
      scope: p.scope,
      status: 'ACTIVE' as const,
      latitude: 53.46,
      longitude: -113.51,
    })),
  ]

  for (const permit of agencyPermitsForSeed(permits)) {
    await prisma.permit.upsert({
      where: { permitNumber: permit.permitNumber },
      update: permit,
      create: permit,
    })
  }

  console.log(`✅ Seeded ${agencyPermitsForSeed(permits).length} agency permits`)
  console.log('')

  console.log('🌱 Seeding municipal permit feed...')
  const municipalFeed = buildMunicipalPermitFeed(permits)
  for (const entry of municipalFeed) {
    await prisma.municipalPermitFeedEntry.upsert({
      where: { permitNumber: entry.permitNumber },
      update: entry,
      create: entry,
    })
  }

  console.log(`✅ Seeded ${municipalFeed.length} municipal feed entries`)
  console.log('')

  // Seed Permit Inspections (M4-S1)
  console.log('🌱 Seeding permit inspections...')

  // Get the created permits
  const permit1 = await prisma.permit.findUnique({ where: { permitNumber: 'BP-2024-001' } })
  const permit2 = await prisma.permit.findUnique({ where: { permitNumber: 'BP-2024-002' } })
  const permit3 = await prisma.permit.findUnique({ where: { permitNumber: 'BP-2024-003' } })
  const permit4 = await prisma.permit.findUnique({ where: { permitNumber: 'BP-2024-004' } })
  const permit5 = await prisma.permit.findUnique({ where: { permitNumber: 'BP-2024-005' } })
  const permit6 = await prisma.permit.findUnique({ where: { permitNumber: 'BP-2024-006' } })
  const permitCB006 = await prisma.permit.findUnique({ where: { permitNumber: 'BP-2024-CB-006' } })
  const permit7 = await prisma.permit.findUniqueOrThrow({ where: { permitNumber: 'BP-2024-007' } })
  const permit8 = await prisma.permit.findUniqueOrThrow({ where: { permitNumber: 'BP-2024-008' } })
  const permitCB001 = await prisma.permit.findUniqueOrThrow({
    where: { permitNumber: 'BP-2024-CB-001' },
  })
  const permitCB002 = await prisma.permit.findUniqueOrThrow({
    where: { permitNumber: 'BP-2024-CB-002' },
  })
  const permitSK001 = await prisma.permit.findUniqueOrThrow({
    where: { permitNumber: 'BP-2024-SK-001' },
  })
  const permitNS001 = await prisma.permit.findUniqueOrThrow({
    where: { permitNumber: 'BP-2024-NS-001' },
  })
  const permitNS002 = await prisma.permit.findUniqueOrThrow({
    where: { permitNumber: 'BP-2024-NS-002' },
  })
  const permitNS003 = await prisma.permit.findUniqueOrThrow({
    where: { permitNumber: 'BP-2024-NS-003' },
  })

  // Create inspections for various permits
  const inspections: PermitInspection[] = []

  // Inspection 1: Scheduled for permit 1, assigned to inspector 1
  const inspection1 = await prisma.permitInspection.create({
    data: {
      permitId: permit1!.id,
      status: 'SCHEDULED',
      scheduledDate: new Date('2024-06-15T10:00:00Z'),
      notes: 'Foundation inspection - first visit',
    },
  })
  inspections.push(inspection1)

  // Create schedule for inspection 1
  await prisma.inspectionSchedule.create({
    data: {
      inspectionId: inspection1.id,
      assignedToId: inspector1.id,
      assignedDate: new Date('2024-06-01T09:00:00Z'),
    },
  })

  // Inspection 2: In progress for permit 2, assigned to inspector 1
  const inspection2 = await prisma.permitInspection.create({
    data: {
      permitId: permit2!.id,
      status: 'IN_PROGRESS',
      scheduledDate: new Date('2024-06-10T14:00:00Z'),
      notes: 'Kitchen renovation - rough-in inspection',
    },
  })
  inspections.push(inspection2)

  await prisma.inspectionSchedule.create({
    data: {
      inspectionId: inspection2.id,
      assignedToId: inspector1.id,
      assignedDate: new Date('2024-06-05T09:00:00Z'),
    },
  })

  // Inspection 3: Scheduled for permit 3, assigned to inspector 2
  const inspection3 = await prisma.permitInspection.create({
    data: {
      permitId: permit3!.id,
      status: 'SCHEDULED',
      scheduledDate: new Date('2024-06-20T09:00:00Z'),
      notes: 'Garage addition - framing inspection',
    },
  })
  inspections.push(inspection3)

  await prisma.inspectionSchedule.create({
    data: {
      inspectionId: inspection3.id,
      assignedToId: inspector2.id,
      assignedDate: new Date('2024-06-08T09:00:00Z'),
    },
  })

  // Inspection 4: Passed for permit 4, assigned to inspector 2
  const inspection4 = await prisma.permitInspection.create({
    data: {
      permitId: permit4!.id,
      status: 'PASSED',
      scheduledDate: new Date('2024-06-05T11:00:00Z'),
      completedDate: new Date('2024-06-05T12:30:00Z'),
      notes: 'Office renovation - final inspection passed',
    },
  })
  inspections.push(inspection4)

  await prisma.inspectionSchedule.create({
    data: {
      inspectionId: inspection4.id,
      assignedToId: inspector2.id,
      assignedDate: new Date('2024-06-01T09:00:00Z'),
    },
  })

  // Inspection 5: Multiple inspections for permit 5 (multi-family dwelling)
  const inspection5a = await prisma.permitInspection.create({
    data: {
      permitId: permit5!.id,
      status: 'PASSED',
      scheduledDate: new Date('2024-05-15T10:00:00Z'),
      completedDate: new Date('2024-05-15T11:00:00Z'),
      notes: 'Foundation inspection - passed',
    },
  })
  inspections.push(inspection5a)

  await prisma.inspectionSchedule.create({
    data: {
      inspectionId: inspection5a.id,
      assignedToId: inspector1.id,
      assignedDate: new Date('2024-05-10T09:00:00Z'),
    },
  })

  const inspection5b = await prisma.permitInspection.create({
    data: {
      permitId: permit5!.id,
      status: 'PASSED',
      scheduledDate: new Date('2024-05-25T14:00:00Z'),
      completedDate: new Date('2024-05-25T15:30:00Z'),
      notes: 'Framing inspection - passed',
    },
  })
  inspections.push(inspection5b)

  await prisma.inspectionSchedule.create({
    data: {
      inspectionId: inspection5b.id,
      assignedToId: inspector1.id,
      assignedDate: new Date('2024-05-20T09:00:00Z'),
    },
  })

  const inspection5c = await prisma.permitInspection.create({
    data: {
      permitId: permit5!.id,
      status: 'SCHEDULED',
      scheduledDate: new Date('2024-06-25T10:00:00Z'),
      notes: 'Electrical rough-in inspection',
    },
  })
  inspections.push(inspection5c)

  await prisma.inspectionSchedule.create({
    data: {
      inspectionId: inspection5c.id,
      assignedToId: inspector1.id,
      assignedDate: new Date('2024-06-15T09:00:00Z'),
    },
  })

  // Inspection 6: Plumbing inspection for permit 6, assigned to inspector 2
  const inspection6 = await prisma.permitInspection.create({
    data: {
      permitId: permit6!.id,
      status: 'SCHEDULED',
      scheduledDate: new Date('2024-06-18T13:00:00Z'),
      notes: 'Plumbing rough-in inspection',
    },
  })
  inspections.push(inspection6)

  await prisma.inspectionSchedule.create({
    data: {
      inspectionId: inspection6.id,
      assignedToId: inspector2.id,
      assignedDate: new Date('2024-06-10T09:00:00Z'),
    },
  })

  // Inspections for BP-2024-CB-006 (Cape Breton permit)
  // Inspection 7a: Foundation inspection - PASSED
  const inspection7a = await prisma.permitInspection.create({
    data: {
      permitId: permitCB006!.id,
      status: 'PASSED',
      scheduledDate: new Date('2024-05-20T10:00:00Z'),
      completedDate: new Date('2024-05-20T11:30:00Z'),
      notes: 'Foundation inspection - passed with no deficiencies',
    },
  })
  inspections.push(inspection7a)

  await prisma.inspectionSchedule.create({
    data: {
      inspectionId: inspection7a.id,
      assignedToId: inspector1.id,
      assignedDate: new Date('2024-05-15T09:00:00Z'),
    },
  })

  // Inspection 7b: Framing inspection - PASSED
  const inspection7b = await prisma.permitInspection.create({
    data: {
      permitId: permitCB006!.id,
      status: 'PASSED',
      scheduledDate: new Date('2024-06-01T14:00:00Z'),
      completedDate: new Date('2024-06-01T15:45:00Z'),
      notes: 'Framing inspection - passed',
    },
  })
  inspections.push(inspection7b)

  await prisma.inspectionSchedule.create({
    data: {
      inspectionId: inspection7b.id,
      assignedToId: inspector1.id,
      assignedDate: new Date('2024-05-28T09:00:00Z'),
    },
  })

  // Inspection 7c: Electrical rough-in - SCHEDULED
  const inspection7c = await prisma.permitInspection.create({
    data: {
      permitId: permitCB006!.id,
      status: 'SCHEDULED',
      scheduledDate: new Date('2024-06-22T10:00:00Z'),
      notes: 'Electrical rough-in inspection',
    },
  })
  inspections.push(inspection7c)

  await prisma.inspectionSchedule.create({
    data: {
      inspectionId: inspection7c.id,
      assignedToId: inspector1.id,
      assignedDate: new Date('2024-06-18T09:00:00Z'),
    },
  })

  // Inspection 7d: Plumbing rough-in - SCHEDULED
  const inspection7d = await prisma.permitInspection.create({
    data: {
      permitId: permitCB006!.id,
      status: 'SCHEDULED',
      scheduledDate: new Date('2024-06-24T13:00:00Z'),
      notes: 'Plumbing rough-in inspection',
    },
  })
  inspections.push(inspection7d)

  await prisma.inspectionSchedule.create({
    data: {
      inspectionId: inspection7d.id,
      assignedToId: inspector2.id,
      assignedDate: new Date('2024-06-19T09:00:00Z'),
    },
  })

  // Inspection 7e: Insulation inspection - SCHEDULED
  const inspection7e = await prisma.permitInspection.create({
    data: {
      permitId: permitCB006!.id,
      status: 'SCHEDULED',
      scheduledDate: new Date('2024-06-28T09:30:00Z'),
      notes: 'Insulation and vapor barrier inspection',
    },
  })
  inspections.push(inspection7e)

  await prisma.inspectionSchedule.create({
    data: {
      inspectionId: inspection7e.id,
      assignedToId: inspector1.id,
      assignedDate: new Date('2024-06-20T09:00:00Z'),
    },
  })

  // Dartmouth NS permits — smoke data (Continue inspection + Deficiencies + Start inspection)
  const inspectionNS1 = await prisma.permitInspection.create({
    data: {
      permitId: permitNS001.id,
      status: 'IN_PROGRESS',
      scheduledDate: new Date('2024-07-08T14:00:00Z'),
      notes: 'Dartmouth NS — new dwelling framing / building field inspection (dev smoke)',
    },
  })
  inspections.push(inspectionNS1)
  await prisma.inspectionSchedule.create({
    data: {
      inspectionId: inspectionNS1.id,
      assignedToId: inspector1.id,
      assignedDate: new Date('2024-07-01T09:00:00Z'),
    },
  })

  const inspectionNS2 = await prisma.permitInspection.create({
    data: {
      permitId: permitNS002.id,
      status: 'SCHEDULED',
      scheduledDate: new Date('2024-07-12T10:00:00Z'),
      notes: 'Dartmouth NS — retail renovation scheduled (dev smoke: Start inspection)',
    },
  })
  inspections.push(inspectionNS2)
  await prisma.inspectionSchedule.create({
    data: {
      inspectionId: inspectionNS2.id,
      assignedToId: inspector1.id,
      assignedDate: new Date('2024-07-02T09:00:00Z'),
    },
  })

  const inspectionNS3 = await prisma.permitInspection.create({
    data: {
      permitId: permitNS003.id,
      status: 'IN_PROGRESS',
      scheduledDate: new Date('2024-07-09T13:30:00Z'),
      notes: 'Dartmouth NS — second storey addition in progress (dev smoke)',
    },
  })
  inspections.push(inspectionNS3)
  await prisma.inspectionSchedule.create({
    data: {
      inspectionId: inspectionNS3.id,
      assignedToId: inspector1.id,
      assignedDate: new Date('2024-07-03T09:00:00Z'),
    },
  })

  // ─── Unassigned inspections (Assignment grid manual verification) ──────────
  // SCHEDULED inspections with NO inspectionSchedule row. These are exactly what
  // the Assignment grid surfaces in its "unassigned" pool (getGridData filters on
  // status: 'SCHEDULED', schedule: null, permitId: not null). Without these, the
  // grid shows "No unassigned inspections to place".
  console.log('🌱 Seeding unassigned inspections (Assignment grid pool)...')
  const unassignedSeed = [
    { permit: permit7, notes: 'Electrical service upgrade — needs assignment' },
    { permit: permit8, notes: 'Foundation inspection — needs assignment' },
    { permit: permitCB001, notes: 'New dwelling framing — needs assignment' },
    { permit: permitCB002, notes: 'Retail renovation rough-in — needs assignment' },
    { permit: permitSK001, notes: 'La Ronge new construction — needs assignment' },
  ]
  for (const [idx, item] of unassignedSeed.entries()) {
    const unassigned = await prisma.permitInspection.create({
      data: {
        permitId: item.permit.id,
        status: 'SCHEDULED',
        // Spread across the current week so they read as "this week" in the grid.
        scheduledDate: new Date(Date.now() + idx * 24 * 60 * 60 * 1000),
        notes: item.notes,
      },
    })
    inspections.push(unassigned)
    // NOTE: intentionally NO prisma.inspectionSchedule.create() here.
  }
  console.log(`✅ Seeded ${unassignedSeed.length} unassigned inspections (no schedule row)`)

  // ─── Code library (M5 code reference search when marking FAIL) ─────────────
  console.log('🌱 Seeding code library...')
  await prisma.codeLibrary.createMany({
    data: [
      {
        code: 'NBC',
        section: '9.10.1',
        title: 'Fire separation',
        description: 'Fire separation between units',
      },
      {
        code: 'NBC',
        section: '3.4.1',
        title: 'Exit signs',
        description: 'Exit signs illuminated',
      },
      {
        code: 'NBC',
        section: '9.8.8',
        title: 'Guards and handrails',
        description: 'Handrails and guards secure',
      },
      {
        code: 'NBC',
        section: '3.8.1',
        title: 'Accessibility',
        description: 'Accessible routes',
      },
      {
        code: 'NEC',
        section: '110.3',
        title: 'Examination of equipment',
        description: null,
      },
    ],
    skipDuplicates: true,
  })
  console.log('✅ Code library (NBC / NEC sample rows)')

  // ─── Checklist templates (required for POST /api/checklists/executions) ───
  console.log('🌱 Seeding checklist templates...')
  const buildingChecklistItems = [
    {
      id: 'seed-item-1',
      order: 1,
      text: 'Fire separation maintained between units',
      category: 'Fire',
      isRequired: true,
      requiresPhoto: false,
      codeReferences: [{ code: 'NBC', section: '9.10.1' }],
    },
    {
      id: 'seed-item-2',
      order: 2,
      text: 'Exit signs illuminated',
      category: 'Fire',
      isRequired: true,
      requiresPhoto: false,
      codeReferences: [{ code: 'NBC', section: '3.4.1' }],
    },
    {
      id: 'seed-item-3',
      order: 3,
      text: 'Handrails and guards secure',
      category: 'Building',
      isRequired: true,
      requiresPhoto: false,
      codeReferences: [{ code: 'NBC', section: '9.8.8' }],
    },
    {
      id: 'seed-item-4',
      order: 4,
      text: 'Optional advisory — accessibility route',
      category: 'Building',
      isRequired: false,
      requiresPhoto: false,
      codeReferences: [{ code: 'NBC', section: '3.8.1' }],
    },
  ]
  const buildingTemplate = await prisma.checklistTemplate.create({
    data: {
      name: 'Building — Field inspection (dev seed)',
      discipline: 'Building',
      version: 1,
      versionHash: 'sha256:dev-seed-building-checklist-v1',
      items: buildingChecklistItems,
      isActive: true,
    },
  })
  await prisma.checklistTemplate.create({
    data: {
      name: 'Electrical — Rough-in (dev seed)',
      discipline: 'Electrical',
      version: 1,
      versionHash: 'sha256:dev-seed-electrical-checklist-v1',
      items: [
        {
          id: 'seed-el-1',
          order: 1,
          text: 'Panel labeling and clearances',
          category: 'Electrical',
          isRequired: true,
          requiresPhoto: false,
        },
        {
          id: 'seed-el-2',
          order: 2,
          text: 'GFCI protection where required',
          category: 'Electrical',
          isRequired: true,
          requiresPhoto: false,
        },
      ],
      isActive: true,
    },
  })
  console.log(`✅ Checklist templates: Building (${buildingTemplate.id}), Electrical`)

  // Open execution on IN_PROGRESS inspection (permit BP-2024-002) → “Continue inspection”
  const partialResponseTs = new Date().toISOString()
  await prisma.checklistExecution.create({
    data: {
      inspectionId: inspection2.id,
      templateId: buildingTemplate.id,
      versionHash: buildingTemplate.versionHash,
      responses: [
        {
          itemId: 'seed-item-1',
          result: 'PASS',
          timestamp: partialResponseTs,
        },
        {
          itemId: 'seed-item-2',
          result: 'FAIL',
          codeReference: { code: 'NBC', section: '3.4.1', title: 'Exit signs' },
          timestamp: partialResponseTs,
        },
      ],
      progress: 50,
    },
  })
  console.log(
    '✅ Checklist execution (in progress) linked to inspection on permit BP-2024-002 — use Continue inspection',
  )
  console.log(
    '   (M6-S14) seed-item-2 is FAIL with two linked deficiencies — amber indicator with count 2 on checklist',
  )

  const partialNs1Ts = new Date().toISOString()
  await prisma.checklistExecution.create({
    data: {
      inspectionId: inspectionNS1.id,
      templateId: buildingTemplate.id,
      versionHash: buildingTemplate.versionHash,
      responses: [
        {
          itemId: 'seed-item-1',
          result: 'PASS',
          timestamp: partialNs1Ts,
        },
      ],
      progress: 25,
    },
  })
  const partialNs3Ts = new Date().toISOString()
  await prisma.checklistExecution.create({
    data: {
      inspectionId: inspectionNS3.id,
      templateId: buildingTemplate.id,
      versionHash: buildingTemplate.versionHash,
      responses: [
        {
          itemId: 'seed-item-1',
          result: 'PASS',
          timestamp: partialNs3Ts,
        },
        {
          itemId: 'seed-item-2',
          result: 'PASS',
          timestamp: partialNs3Ts,
        },
      ],
      progress: 50,
    },
  })
  console.log(
    '✅ Checklist executions (in progress) on BP-2024-NS-001 and BP-2024-NS-003 — Continue inspection (Dartmouth smoke)',
  )

  // Sample deficiencies for inspector deficiency list / detail smoke (M6-S9)
  await prisma.deficiency.create({
    data: {
      clientId: 'seed-def-client-001',
      inspectionId: inspection2.id,
      checklistItemId: 'seed-item-2',
      createdById: inspector1.id,
      description:
        'Dev seed deficiency — exit signage not illuminated in east stairwell (smoke test detail view).',
      location: 'East stair B2',
      severity: 'MAJOR',
      status: 'OPEN',
      codeReference: { code: 'NBC', section: '3.4.1', title: 'Exit signs' },
      isStopWork: false,
      isUnsafe: false,
    },
  })
  await prisma.deficiency.create({
    data: {
      clientId: 'seed-def-client-002',
      inspectionId: inspection2.id,
      checklistItemId: 'seed-item-2',
      createdById: inspector1.id,
      description:
        'Dev seed deficiency — secondary exit route signage blocked during rough-in (M6-S14 multi-link smoke).',
      location: 'East stair landing',
      severity: 'CRITICAL',
      status: 'OPEN',
      codeReference: { code: 'NBC', section: '3.4.1', title: 'Exit signs' },
      isStopWork: true,
      isUnsafe: true,
    },
  })
  console.log(
    '✅ Sample deficiencies on IN_PROGRESS inspection (permit BP-2024-002) — open Deficiencies then a card for detail',
  )

  await prisma.deficiency.create({
    data: {
      clientId: 'seed-def-ns-001',
      inspectionId: inspectionNS1.id,
      createdById: inspector1.id,
      description:
        'Dev seed (Dartmouth) — fire separation not maintained at party wall; smoke test deficiency detail.',
      location: 'Party wall — main floor',
      severity: 'MAJOR',
      status: 'OPEN',
      codeReference: { code: 'NBC', section: '9.10.1', title: 'Fire separation' },
      isStopWork: false,
      isUnsafe: false,
    },
  })
  await prisma.deficiency.create({
    data: {
      clientId: 'seed-def-ns-002',
      inspectionId: inspectionNS1.id,
      createdById: inspector1.id,
      description:
        'Dev seed (Dartmouth) — handrail height non-compliant at interior stair; smoke test.',
      location: 'Interior stair to second floor',
      severity: 'MINOR',
      status: 'OPEN',
      codeReference: { code: 'NBC', section: '9.8.8', title: 'Guards and handrails' },
      isStopWork: false,
      isUnsafe: false,
    },
  })
  await prisma.deficiency.create({
    data: {
      clientId: 'seed-def-ns-003',
      inspectionId: inspectionNS3.id,
      createdById: inspector1.id,
      description:
        'Dev seed (Dartmouth) — exit access partially obstructed during addition work; verify egress.',
      location: 'Side yard temporary access',
      severity: 'CRITICAL',
      status: 'OPEN',
      codeReference: { code: 'NBC', section: '3.4.1', title: 'Exit signs' },
      isStopWork: true,
      isUnsafe: true,
    },
  })
  console.log(
    '✅ Sample deficiencies on BP-2024-NS-001 (2) and BP-2024-NS-003 (1) — Deficiencies list / detail / edit modal smoke',
  )

  // M10-S13 — VoC resubmit smoke (VOC_REJECTED → Submit VoC on deficiency detail)
  await prisma.deficiency.create({
    data: {
      clientId: 'seed-def-voc-rejected',
      inspectionId: inspectionNS1.id,
      createdById: inspector1.id,
      description:
        'Dev seed (Dartmouth) — handrail guard spacing; prior VoC rejected for resubmit smoke (M10-S13).',
      location: 'Interior stair guard',
      severity: 'MAJOR',
      status: 'VOC_REJECTED',
      codeReference: { code: 'NBC', section: '9.8.8', title: 'Guards and handrails' },
      isStopWork: false,
      isUnsafe: false,
    },
  })
  console.log('✅ VOC_REJECTED deficiency on BP-2024-NS-001 — Submit VoC resubmit smoke (M10-S13)')

  // M10-S14 — Admin VoC review queue smoke (pending VoC on in-progress inspection)
  const defPendingVocAdmin = await prisma.deficiency.create({
    data: {
      clientId: 'seed-def-voc-pending-admin',
      inspectionId: inspectionNS1.id,
      createdById: inspector1.id,
      description:
        'Dev seed (Dartmouth) — exit lighting; submitted VoC pending admin review (M10-S14 smoke).',
      location: 'Corridor to exit B',
      severity: 'MINOR',
      status: 'OPEN',
      codeReference: { code: 'NBC', section: '3.2.5', title: 'Exit lighting' },
      isStopWork: false,
      isUnsafe: false,
      vocSubmittedAt: new Date(),
    },
  })
  await prisma.verificationOfCompliance.create({
    data: {
      deficiencyId: defPendingVocAdmin.id,
      verificationDate: new Date('2026-01-15T12:00:00.000Z'),
      sectionTitle: '3.2.5',
      title: 'Exit lighting repaired (seed — M10-S14)',
      name: 'Dartmouth Building Owner',
      method: 'SITE_VISIT',
      comments: 'Electrician verified spare battery pack installed.',
      submittedAt: new Date(),
      status: 'PENDING',
    },
  })
  console.log('✅ PENDING VoC on BP-2024-NS-001 — Admin VoC review queue smoke (M10-S14)')

  // VC-INTAKE-02 — active permit with locked Stop Work order for admin triage
  const permitStopWorkTriage = await prisma.permit.findUniqueOrThrow({
    where: { permitNumber: TRIAGE_STOP_WORK_PERMIT_NUMBER },
  })
  const inspectionStopWorkTriage = await prisma.permitInspection.create({
    data: {
      permitId: permitStopWorkTriage.id,
      status: 'IN_PROGRESS',
      scheduledDate: new Date('2026-03-01T10:00:00Z'),
      notes: 'Addition rough-in — Stop Work issued on site (VC-INTAKE-02 triage smoke)',
    },
  })
  inspections.push(inspectionStopWorkTriage)
  await prisma.inspectionSchedule.create({
    data: {
      inspectionId: inspectionStopWorkTriage.id,
      assignedToId: inspector1.id,
      assignedDate: new Date('2026-02-15T09:00:00Z'),
    },
  })
  const servedAt = new Date('2026-02-20T14:00:00Z')
  const appealDeadline = new Date(servedAt)
  appealDeadline.setUTCDate(appealDeadline.getUTCDate() + 14)
  const defStopWorkTriage = await prisma.deficiency.create({
    data: {
      clientId: 'seed-def-stop-work-triage',
      inspectionId: inspectionStopWorkTriage.id,
      createdById: inspector1.id,
      description:
        'Stop Work — structural framing non-compliant; work halted pending engineer review (VC-INTAKE-02).',
      location: 'Second storey addition',
      severity: 'CRITICAL',
      status: 'OPEN',
      codeReference: { code: 'NBC', section: '4.3.2', title: 'Structural design' },
      isStopWork: true,
      isUnsafe: false,
    },
  })
  await prisma.stopWorkEscalation.create({
    data: {
      deficiencyId: defStopWorkTriage.id,
      servedAt,
      appealDeadline,
      lockedOut: true,
    },
  })
  console.log(
    `✅ Stop Work lock-out on ${TRIAGE_STOP_WORK_PERMIT_NUMBER} — Admin permit triage smoke (VC-INTAKE-02)`,
  )

  // VC-FIELD-02 — BP-2026-004821 assigned to Pat Nguyen with Foundation stage
  const permitFieldSync = await prisma.permit.findUniqueOrThrow({
    where: { permitNumber: FIELD_ASSIGNED_PERMIT.permitNumber },
  })
  const inspectionFieldSync = await prisma.permitInspection.create({
    data: {
      permitId: permitFieldSync.id,
      status: 'SCHEDULED',
      scheduledDate: new Date(FIELD_ASSIGNED_PERMIT.scheduledDate),
      notes: FIELD_ASSIGNED_PERMIT.notes,
    },
  })
  inspections.push(inspectionFieldSync)
  await prisma.inspectionSchedule.create({
    data: {
      inspectionId: inspectionFieldSync.id,
      assignedToId: patNguyen.id,
      assignedDate: new Date(FIELD_ASSIGNED_PERMIT.scheduledDate),
    },
  })
  await prisma.inspectionWorkflow.create({
    data: {
      inspectionId: inspectionFieldSync.id,
      stages: [FIELD_ASSIGNED_PERMIT.stage],
      plannedDate: new Date(FIELD_ASSIGNED_PERMIT.scheduledDate),
    },
  })

  // VC-APPROVE-* — finalize BP-2026-004821, garage deficiency, optional VoC queue seed
  await prisma.permit.update({
    where: { permitNumber: APPROVE_VERIFICATION_PERMIT.permitNumber },
    data: { legalLandDesc: APPROVE_VERIFICATION_PERMIT.legalLandDesc },
  })
  const finalizedAt = new Date(APPROVE_VERIFICATION_PERMIT.finalizedAt)
  const completedDate = new Date(APPROVE_VERIFICATION_PERMIT.completedDate)
  await prisma.permitInspection.update({
    where: { id: inspectionFieldSync.id },
    data: {
      status: 'PASSED',
      finalizedAt,
      completedDate,
      inspectorId: patNguyen.id,
      lastSyncedAt: new Date(),
      uniqueId: 'vc-approve-01-insp',
      documentHash: 'a'.repeat(64),
      startGps: { latitude: 51.0447, longitude: -114.0719, accuracyMeters: 8 },
      finalizeGps: { latitude: 51.0447, longitude: -114.0719, accuracyMeters: 8 },
      certificationSnapshot: {
        inspectorName: 'Pat Nguyen',
        designationId: 'SCO-AB-4821',
        capturedAt: finalizedAt.toISOString(),
      },
    },
  })
  await prisma.inspectionWorkflow.update({
    where: { inspectionId: inspectionFieldSync.id },
    data: { actualDate: completedDate, lastSyncedAt: new Date() },
  })
  const defGarageApprove = await prisma.deficiency.create({
    data: {
      clientId: 'seed-def-garage-fire-vc-approve-03',
      inspectionId: inspectionFieldSync.id,
      createdById: patNguyen.id,
      description: APPROVE_GARAGE_DEFICIENCY.description,
      location: APPROVE_GARAGE_DEFICIENCY.location,
      severity: APPROVE_GARAGE_DEFICIENCY.severity,
      status: 'OPEN',
      codeReference: {
        code: 'NBC',
        section: '9.10.14',
        title: 'Fire separation — garage',
      },
      isStopWork: false,
      isUnsafe: false,
    },
  })
  console.log(
    `✅ Approve verification seed — ${APPROVE_VERIFICATION_PERMIT.permitNumber} finalized (PASSED) with OPEN garage deficiency (VC-APPROVE-01/03/05)`,
  )

  // VC-ASSIGN — keep additional unassigned pool row for admin grid smoke (separate permit)
  const permitAssignGrid = await prisma.permit.findUniqueOrThrow({
    where: { permitNumber: ASSIGNMENT_SUBDIVISION_PERMITS[0].permitNumber },
  })
  const inspectionAssignGrid = await prisma.permitInspection.create({
    data: {
      permitId: permitAssignGrid.id,
      status: 'SCHEDULED',
      scheduledDate: new Date('2026-06-12T10:00:00.000Z'),
      notes: 'Subdivision framing — unassigned grid pool (VC-ASSIGN-02)',
    },
  })
  inspections.push(inspectionAssignGrid)

  for (const sub of ASSIGNMENT_SUBDIVISION_PERMITS) {
    const permit = await prisma.permit.findUniqueOrThrow({
      where: { permitNumber: sub.permitNumber },
    })
    const row = await prisma.permitInspection.create({
      data: {
        permitId: permit.id,
        status: 'SCHEDULED',
        scheduledDate: new Date('2026-06-12T10:00:00.000Z'),
        notes: sub.notes,
      },
    })
    inspections.push(row)
  }

  for (const permitNumber of ASSIGNMENT_NEAR_MAX_PERMIT_NUMBERS) {
    const permit = await prisma.permit.findUniqueOrThrow({ where: { permitNumber } })
    const row = await prisma.permitInspection.create({
      data: {
        permitId: permit.id,
        status: 'SCHEDULED',
        scheduledDate: new Date(ASSIGNMENT_NEAR_MAX_DATE),
        notes: `Near-max workload seed for Pat Nguyen (VC-ASSIGN-04) — ${permitNumber}`,
      },
    })
    inspections.push(row)
    await prisma.inspectionSchedule.create({
      data: {
        inspectionId: row.id,
        assignedToId: patNguyen.id,
        assignedDate: new Date(ASSIGNMENT_NEAR_MAX_DATE),
      },
    })
  }

  console.log(
    `✅ Field verification seed — ${FIELD_ASSIGNED_PERMIT.permitNumber} assigned to Pat Nguyen with ${FIELD_ASSIGNED_PERMIT.stage} stage`,
  )

  // VC-ESCAL-03/04 — BP-2026-004990 unable-to-enter field + admin workflow
  const permitUnableEnter = await prisma.permit.findUniqueOrThrow({
    where: { permitNumber: ESCALATION_UNABLE_TO_ENTER_PERMIT.permitNumber },
  })
  const inspectionUnableEnter = await prisma.permitInspection.create({
    data: {
      permitId: permitUnableEnter.id,
      status: 'SCHEDULED',
      scheduledDate: new Date(ESCALATION_UNABLE_TO_ENTER_PERMIT.scheduledDate),
      notes: ESCALATION_UNABLE_TO_ENTER_PERMIT.notes,
    },
  })
  inspections.push(inspectionUnableEnter)
  await prisma.inspectionSchedule.create({
    data: {
      inspectionId: inspectionUnableEnter.id,
      assignedToId: patNguyen.id,
      assignedDate: new Date(ESCALATION_UNABLE_TO_ENTER_PERMIT.scheduledDate),
    },
  })
  await prisma.inspectionWorkflow.create({
    data: {
      inspectionId: inspectionUnableEnter.id,
      stages: [ESCALATION_UNABLE_TO_ENTER_PERMIT.stage],
      plannedDate: new Date(ESCALATION_UNABLE_TO_ENTER_PERMIT.scheduledDate),
    },
  })
  console.log(
    `✅ Escalation verification seed — ${ESCALATION_UNABLE_TO_ENTER_PERMIT.permitNumber} assigned to Pat Nguyen (VC-ESCAL-03/04)`,
  )

  console.log(`✅ Assignment verification seed — Pat Nguyen near-max day, subdivision bulk permits`)

  console.log(`✅ Seeded ${inspections.length} permit inspections`)
  console.log('   - Inspector 1 (Jane Smith) has 12 inspections assigned')
  console.log('   - Inspector 2 (John Doe) has 4 inspections assigned')
  console.log('   - Permit BP-2024-CB-006 has 5 inspections (2 passed, 3 scheduled)')
  console.log('   - 5 unassigned inspections available in the Assignment grid pool')
  console.log('')
  console.log('📝 Development Credentials:')
  console.log('   Admin Portal: admin@example.com / admin123')
  console.log('   Inspector App: inspector1@example.com / password123')
  console.log('   Inspector App: inspector2@example.com / password123')
  console.log('')
  console.log('🧭 Inspector workflow smoke test (after seed):')
  console.log('   1. Sign in as inspector1@example.com / password123')
  console.log('   2. Permits → open BP-2024-001 → Start inspection (scheduled; creates execution)')
  console.log(
    '   3. Permits → open BP-2024-002 → Continue inspection (IN_PROGRESS + seeded checklist)',
  )
  console.log(
    '   4. Code search on FAIL uses seeded NBC/NEC rows; geofence works on permits with coordinates',
  )
  console.log(
    '   5. Same inspection (BP-2024-002): Deficiencies list → tap a card for M6-S9 detail / edit / delete smoke',
  )
  console.log(
    '   6. Dartmouth NS: BP-2024-NS-001 & BP-2024-NS-003 → Continue inspection + Deficiencies; BP-2024-NS-002 → Start inspection',
  )
  console.log(
    '   7. Admin VoC: admin@example.com / admin123 → VoC review — at least one pending seed item (M10-S14)',
  )
  console.log(
    '   8. Admin Reports: admin@example.com / admin123 → Reports — filter In progress, pick BP-2024-NS-001 or BP-2024-002, generate Inspection Report (M10-S15)',
  )
  console.log(
    '   9. Admin Compliance search: admin@example.com / admin123 → Compliance search — legal land "1234AB" or permit BP-2024-001, Search, Export CSV (M10-S16)',
  )
  console.log(
    '  10. Admin Assignments: admin@example.com / admin123 → Assignments → grid — click an empty cell, then pick one of the 5 unassigned inspections to place it',
  )
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
