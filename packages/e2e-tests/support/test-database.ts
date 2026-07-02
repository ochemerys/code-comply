/**
 * E2E Test Database Manager
 *
 * Handles database setup, seeding, and cleanup for E2E tests.
 * Works with both local Docker PostgreSQL and Render.com PostgreSQL.
 */

import { prisma as prismaBase } from '@codecomply/db'
import type { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcrypt'

/** When generated `PrismaClient` omits `photo`, cleanup can still call `photo.deleteMany`. */
type PrismaClientWithPhoto = PrismaClient & {
  photo: { deleteMany: PrismaClient['deficiency']['deleteMany'] }
}

const prisma = prismaBase as PrismaClientWithPhoto

export class E2ETestDatabase {
  private isInitialized = false

  constructor() {
    // Use E2E test database URL or fall back to default
    const databaseUrl = process.env.E2E_DATABASE_URL || process.env.DATABASE_URL

    if (!databaseUrl) {
      throw new Error('E2E_DATABASE_URL or DATABASE_URL must be set')
    }

    // Reconfigure the db instance to use test database URL
    // Note: This is a workaround since Prisma doesn't allow easy URL changes
    // In production, you'd want to create a separate Prisma instance
  }

  /**
   * Initialize database connection and verify it's accessible
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return

    try {
      // Test connection by running a simple query
      await prisma.user.count()
      console.log('✅ Database connected')
      this.isInitialized = true
    } catch (error) {
      console.error('❌ Database connection failed:', error)
      throw error
    }
  }

  /**
   * Clean all test data from database
   * WARNING: This deletes ALL data - only use in test environments!
   */
  async clean(): Promise<void> {
    console.log('🧹 Cleaning database...')

    try {
      // Delete in correct order to respect foreign key constraints
      await prisma.$transaction([
        prisma.syncConflict.deleteMany(),
        prisma.session.deleteMany(),
        prisma.photo.deleteMany(),
        prisma.deficiency.deleteMany(),
        prisma.inspectionSchedule.deleteMany(),
        prisma.checklistExecution.deleteMany(),
        prisma.permitInspection.deleteMany(),
        prisma.permit.deleteMany(),
        prisma.checklistTemplate.deleteMany(),
        prisma.codeLibrary.deleteMany(),
        prisma.user.deleteMany(),
      ])

      console.log('✅ Database cleaned')
    } catch (error) {
      console.error('❌ Database clean failed:', error)
      throw error
    }
  }

  /**
   * Seed database with base test data
   * This creates the minimum data needed for most tests
   */
  async seedBase(): Promise<TestUsers> {
    console.log('🌱 Seeding base test data...')

    const passwordHash = await bcrypt.hash('Test123!', 10)

    const admin = await prisma.user.create({
      data: {
        email: 'test-admin@example.com',
        name: 'Test Admin',
        role: 'ADMIN',
        passwordHash,
        certifications: [
          {
            id: 'test-cert-admin-1',
            name: 'Administrative Certification',
            designation: 'ADMIN-CERT',
            isValid: true,
            expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          },
        ],
        disciplines: ['Administration'],
      },
    })

    const inspector = await prisma.user.create({
      data: {
        email: 'test-inspector@example.com',
        name: 'Test Inspector',
        role: 'SCO',
        passwordHash,
        certifications: [
          {
            id: 'test-cert-insp-1',
            name: 'Building Code Certification',
            designation: 'SCO-BC',
            isValid: true,
            expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          },
        ],
        disciplines: ['Building', 'Electrical'],
        designationId: 'TEST-SCO-001',
      },
    })

    const owner = await prisma.user.create({
      data: {
        email: 'test-owner@example.com',
        name: 'Test Owner',
        role: 'OWNER',
        passwordHash,
        certifications: [],
        disciplines: [],
      },
    })

    await prisma.codeLibrary.createMany({
      data: [
        {
          code: 'NBC',
          section: '9.10.1',
          title: 'Fire resistance ratings',
          description: 'Fire separation and Fire keyword for E2E search',
        },
        {
          code: 'NBC',
          section: '3.4.1',
          title: 'Exit signs',
          description: 'Illuminated exit signs',
        },
      ],
    })

    console.log('✅ Base test data seeded')
    console.log(`   Admin: ${admin.email}`)
    console.log(`   Inspector: ${inspector.email}`)
    console.log(`   Owner: ${owner.email}`)
    console.log(`   Password: Test123!`)

    return { admin, inspector, owner }
  }

  /**
   * Seed database with comprehensive test data for all scenarios
   * Note: Currently limited to User and Session models available in schema
   */
  async seedComprehensive(): Promise<ComprehensiveTestData> {
    console.log('🌱 Seeding comprehensive test data...')

    const baseUsers = await this.seedBase()

    // Create additional inspectors with different certifications
    const passwordHash = await bcrypt.hash('Test123!', 10)

    const inspector2 = await prisma.user.create({
      data: {
        email: 'test-inspector2@example.com',
        name: 'Test Inspector 2',
        role: 'SCO',
        passwordHash,
        certifications: [
          {
            id: 'test-cert-insp2-1',
            name: 'Plumbing Safety Certification',
            designation: 'SCO-PS',
            isValid: true,
            expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          },
        ],
        disciplines: ['Plumbing', 'Gas'],
        designationId: 'TEST-SCO-002',
      },
    })

    // For now, return mock data for future models
    // These will be replaced when the actual models are added to the schema
    const mockPermit1 = { id: 'mock-permit-1', permitNumber: 'BP-2024-001' }
    const mockPermit2 = { id: 'mock-permit-2', permitNumber: 'EP-2024-002' }
    const mockSchedule1 = { id: 'mock-schedule-1' }
    const mockSchedule2 = { id: 'mock-schedule-2' }
    const mockInspection1 = { id: 'mock-inspection-1', clientId: 'TEST-INSP-001' }
    const mockInspection2 = { id: 'mock-inspection-2', clientId: 'TEST-INSP-002' }

    console.log('✅ Comprehensive test data seeded')
    console.log(`   Users: ${Object.keys(baseUsers).length + 1}`)
    console.log(`   Note: Permit/Inspection models not yet implemented in schema`)

    return {
      users: { ...baseUsers, inspector2 },
      permits: { permit1: mockPermit1, permit2: mockPermit2 },
      schedules: { schedule1: mockSchedule1, schedule2: mockSchedule2 },
      inspections: { inspection1: mockInspection1, inspection2: mockInspection2 },
    }
  }

  /**
   * Seed data for a specific BDD scenario
   */
  async seedScenario(scenarioName: string, data: any): Promise<void> {
    console.log(`🌱 Seeding scenario: ${scenarioName}`)

    // Implement scenario-specific seeding logic
    // This can be extended based on your BDD scenarios
    switch (scenarioName) {
      case 'authentication':
        await this.seedBase()
        break

      case 'offline-sync':
        await this.seedComprehensive()
        break

      case 'deficiency-management':
        await this.seedComprehensive()
        break

      default:
        console.log(`⚠️  Unknown scenario: ${scenarioName}, using base seed`)
        await this.seedBase()
    }

    console.log(`✅ Scenario data seeded: ${scenarioName}`)
  }

  /**
   * Get test user credentials
   */
  getTestCredentials(): TestCredentials {
    return {
      admin: {
        email: 'test-admin@example.com',
        password: 'Test123!',
      },
      inspector: {
        email: 'test-inspector@example.com',
        password: 'Test123!',
      },
      inspector2: {
        email: 'test-inspector2@example.com',
        password: 'Test123!',
      },
      owner: {
        email: 'test-owner@example.com',
        password: 'Test123!',
      },
    }
  }

  /**
   * Get Prisma client for direct database access in tests
   */
  getClient(): PrismaClientWithPhoto {
    return prisma
  }

  /**
   * Disconnect from database
   */
  async disconnect(): Promise<void> {
    if (this.isInitialized) {
      await prisma.$disconnect()
      this.isInitialized = false
      console.log('✅ Database disconnected')
    }
  }

  /**
   * Reset database to clean state and seed base data
   * This is the main method to call between test scenarios
   */
  async reset(): Promise<TestUsers> {
    await this.clean()
    return await this.seedBase()
  }
}

// Type definitions
export interface TestUsers {
  admin: any
  inspector: any
  owner: any
}

export interface ComprehensiveTestData {
  users: TestUsers & { inspector2: any }
  permits: {
    permit1: any
    permit2: any
  }
  schedules: {
    schedule1: any
    schedule2: any
  }
  inspections: {
    inspection1: any
    inspection2: any
  }
}

export interface TestCredentials {
  admin: { email: string; password: string }
  inspector: { email: string; password: string }
  inspector2: { email: string; password: string }
  owner: { email: string; password: string }
}

// Singleton instance
let dbInstance: E2ETestDatabase | null = null

export function getTestDatabase(): E2ETestDatabase {
  if (!dbInstance) {
    dbInstance = new E2ETestDatabase()
  }
  return dbInstance
}
