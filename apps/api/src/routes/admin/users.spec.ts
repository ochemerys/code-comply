import { describe, it, expect, beforeEach, vi } from 'vitest'
import { testClient } from 'hono/testing'
import { Hono } from 'hono'
import type { User } from '@codecomply/db'
import type { UserDTO } from '@codecomply/validators'
import usersApp from './users'
import { adminUserService } from '../../services/admin-user.service'
import { remoteWipeService } from '../../services/remote-wipe.service'
import { UserMapper } from '../../mappers/user.mapper'
import { roleMiddleware } from '../../middleware/auth.middleware'

vi.mock('../../services/admin-user.service')
vi.mock('../../services/remote-wipe.service')
vi.mock('../../mappers/user.mapper')

/** `testClient()` is typed as `unknown`; narrow to the routes this spec exercises. */
type AdminUsersTestClient = {
  index: {
    $get: (opts: { query?: Record<string, unknown> }) => Promise<Response>
    $post: (opts: { json: Record<string, unknown> }) => Promise<Response>
  }
  ':id': {
    $get: (opts: { param: { id: string } }) => Promise<Response>
    $patch: (opts: { param: { id: string }; json: Record<string, unknown> }) => Promise<Response>
    certifications: {
      $post: (opts: {
        param: { id: string }
        json: { certifications: unknown[] }
      }) => Promise<Response>
    }
    deactivate: { $post: (opts: { param: { id: string } }) => Promise<Response> }
    'remote-wipe': { $post: (opts: { param: { id: string } }) => Promise<Response> }
  }
}

const createAdminTestApp = () => {
  const testApp = new Hono()
  testApp.use('*', async (c, next) => {
    c.set('user', { id: 'admin-1', role: 'ADMIN' } as User)
    c.set('userId', 'admin-1')
    await next()
  })
  testApp.use('*', roleMiddleware(['ADMIN']))
  testApp.route('/', usersApp)
  return testApp
}

const createForbiddenTestApp = () => {
  const testApp = new Hono()
  testApp.use('*', async (c, next) => {
    c.set('user', { id: 'sco-1', role: 'SCO' } as User)
    c.set('userId', 'sco-1')
    await next()
  })
  testApp.use('*', roleMiddleware(['ADMIN']))
  testApp.route('/', usersApp)
  return testApp
}

async function jsonBody<T>(res: Response): Promise<T> {
  return (await res.json()) as T
}

const adminUsersClient = () => testClient(createAdminTestApp()) as AdminUsersTestClient
const forbiddenUsersClient = () => testClient(createForbiddenTestApp()) as AdminUsersTestClient

describe('Admin users routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('POST / creates user', async () => {
    const row = { id: 'u-new', email: 'new@test.com', name: 'New', role: 'SCO' } as any
    vi.mocked(adminUserService.create).mockResolvedValue({ user: row })
    vi.mocked(UserMapper.toDTO).mockReturnValue({
      id: 'u-new',
      email: 'new@test.com',
      name: 'New',
      role: 'SCO',
    } as any)

    const res = await adminUsersClient().index.$post({
      json: { email: 'new@test.com', name: 'New', role: 'SCO' },
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.user.id).toBe('u-new')
    expect(adminUserService.create).toHaveBeenCalled()
  })

  it('POST / returns 409 when email exists', async () => {
    vi.mocked(adminUserService.create).mockRejectedValue(new Error('Email already registered'))

    const res = await adminUsersClient().index.$post({
      json: { email: 'dup@test.com', name: 'Dup' },
    })
    expect(res.status).toBe(409)
  })

  it('GET / returns mapped users', async () => {
    const rows = [{ id: 'u1' }] as any[]
    vi.mocked(adminUserService.list).mockResolvedValue(rows)
    vi.mocked(UserMapper.toDTO).mockReturnValue({ id: 'u1', email: 'a@b.c' } as any)

    const res = await adminUsersClient().index.$get({ query: {} })
    expect(res.status).toBe(200)
    expect(await jsonBody<UserDTO[]>(res)).toEqual([{ id: 'u1', email: 'a@b.c' } as UserDTO])
    expect(adminUserService.list).toHaveBeenCalledWith({})
  })

  it('GET / passes list filters', async () => {
    vi.mocked(adminUserService.list).mockResolvedValue([])
    vi.mocked(UserMapper.toDTO).mockImplementation((u: any) => u)

    await adminUsersClient().index.$get({
      query: { role: 'SCO', isActive: 'true', search: '  jane  ' },
    })
    expect(adminUserService.list).toHaveBeenCalledWith({
      role: 'SCO',
      isActive: true,
      search: '  jane  ',
    })
  })

  it('GET /{id} returns 404 when missing', async () => {
    vi.mocked(adminUserService.getById).mockResolvedValue(null)
    const res = await adminUsersClient()[':id'].$get({ param: { id: 'x' } })
    expect(res.status).toBe(404)
  })

  it('GET /{id} returns user', async () => {
    const row = { id: 'u1' } as any
    vi.mocked(adminUserService.getById).mockResolvedValue(row)
    vi.mocked(UserMapper.toDTO).mockReturnValue({ id: 'u1' } as any)
    const res = await adminUsersClient()[':id'].$get({ param: { id: 'u1' } })
    expect(res.status).toBe(200)
    expect(await jsonBody<UserDTO>(res)).toEqual({ id: 'u1' } as UserDTO)
  })

  it('PATCH /{id} updates user', async () => {
    const row = { id: 'u1' } as any
    vi.mocked(adminUserService.update).mockResolvedValue(row)
    vi.mocked(UserMapper.toDTO).mockReturnValue({ id: 'u1', name: 'N' } as any)
    const res = await adminUsersClient()[':id'].$patch({
      param: { id: 'u1' },
      json: { name: 'N' },
    })
    expect(res.status).toBe(200)
    expect(adminUserService.update).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ name: 'N' }),
    )
  })

  it('PATCH /{id} returns 404 when user missing', async () => {
    vi.mocked(adminUserService.update).mockRejectedValue(new Error('User not found'))
    const res = await adminUsersClient()[':id'].$patch({
      param: { id: 'u1' },
      json: { name: 'N' },
    })
    expect(res.status).toBe(404)
  })

  it('POST /{id}/certifications updates certs', async () => {
    const row = { id: 'u1' } as any
    const certs = [
      {
        id: 'c1',
        discipline: 'Building',
        authority: 'AB',
        issuedDate: '2024-01-01T00:00:00.000Z',
        status: 'ACTIVE' as const,
      },
    ]
    vi.mocked(adminUserService.updateCertifications).mockResolvedValue(row)
    vi.mocked(UserMapper.toDTO).mockReturnValue({ id: 'u1' } as any)
    const res = await adminUsersClient()[':id'].certifications.$post({
      param: { id: 'u1' },
      json: { certifications: certs },
    })
    expect(res.status).toBe(200)
    expect(adminUserService.updateCertifications).toHaveBeenCalledWith('u1', certs)
  })

  it('POST /{id}/deactivate', async () => {
    const row = { id: 'u1' } as any
    vi.mocked(adminUserService.deactivate).mockResolvedValue(row)
    vi.mocked(UserMapper.toDTO).mockReturnValue({ id: 'u1', isActive: false } as any)
    const res = await adminUsersClient()[':id'].deactivate.$post({
      param: { id: 'u1' },
    })
    expect(res.status).toBe(200)
    expect(adminUserService.deactivate).toHaveBeenCalledWith('u1')
  })

  it('POST /{id}/remote-wipe triggers wipe', async () => {
    const requestedAt = new Date('2026-05-19T10:00:00Z')
    vi.mocked(remoteWipeService.requestRemoteWipe).mockResolvedValue({
      id: 'sco-1',
      remoteWipeRequestedAt: requestedAt,
    } as any)

    const res = await adminUsersClient()[':id']['remote-wipe'].$post({
      param: { id: 'sco-1' },
    })
    expect(res.status).toBe(200)
    const body = await jsonBody<{ message: string; userId: string }>(res)
    expect(body.message).toBe('Remote wipe requested')
    expect(remoteWipeService.requestRemoteWipe).toHaveBeenCalledWith('sco-1', 'admin-1')
  })

  it('returns 403 for non-admin', async () => {
    vi.mocked(adminUserService.list).mockResolvedValue([])
    const res = await forbiddenUsersClient().index.$get({ query: {} })
    expect(res.status).toBe(403)
  })
})
