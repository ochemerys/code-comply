import { describe, it, expect } from 'vitest'
import { prisma as appPrisma } from '../../src/client.js'
import * as dbEntry from '../../src/index.js'

describe('@codecomply/db client (smoke)', () => {
  it('exports a PrismaClient-compatible instance from client', () => {
    expect(appPrisma).toBeDefined()
    expect(typeof appPrisma.$connect).toBe('function')
  })

  it('re-exports prisma from package entry', () => {
    expect(dbEntry.prisma).toBe(appPrisma)
  })
})
