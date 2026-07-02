import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import {
  AdminCreateUserBodySchema,
  AdminCreateUserResponseSchema,
  AdminPatchUserBodySchema,
  AdminUserCertificationsBodySchema,
  AdminUserListQuerySchema,
  RemoteWipeTriggerResponseSchema,
  UserDTOSchema,
} from '@codecomply/validators'
import { adminUserService } from '../../services/admin-user.service.js'
import { remoteWipeService } from '../../services/remote-wipe.service.js'
import { UserMapper } from '../../mappers/user.mapper.js'

const ErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string().optional(),
})

const createUserRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['Admin'],
  summary: 'Create user (admin)',
  request: {
    body: { content: { 'application/json': { schema: AdminCreateUserBodySchema } } },
  },
  responses: {
    201: {
      description: 'Created user',
      content: { 'application/json': { schema: AdminCreateUserResponseSchema } },
    },
    400: {
      description: 'Bad request',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    403: {
      description: 'Forbidden',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    409: {
      description: 'Conflict',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    500: {
      description: 'Server error',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
})

const listUsersRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Admin'],
  summary: 'List users (admin)',
  request: { query: AdminUserListQuerySchema },
  responses: {
    200: {
      description: 'Users',
      content: { 'application/json': { schema: z.array(UserDTOSchema) } },
    },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    403: {
      description: 'Forbidden',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    500: {
      description: 'Server error',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
})

const getUserRoute = createRoute({
  method: 'get',
  path: '/{id}',
  tags: ['Admin'],
  summary: 'Get user by id (admin)',
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: {
      description: 'User',
      content: { 'application/json': { schema: UserDTOSchema } },
    },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    403: {
      description: 'Forbidden',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    404: {
      description: 'Not found',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    500: {
      description: 'Server error',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
})

const patchUserRoute = createRoute({
  method: 'patch',
  path: '/{id}',
  tags: ['Admin'],
  summary: 'Update user (admin)',
  request: {
    params: z.object({ id: z.string() }),
    body: { content: { 'application/json': { schema: AdminPatchUserBodySchema } } },
  },
  responses: {
    200: {
      description: 'Updated user',
      content: { 'application/json': { schema: UserDTOSchema } },
    },
    400: {
      description: 'Bad request',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    403: {
      description: 'Forbidden',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    404: {
      description: 'Not found',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    500: {
      description: 'Server error',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
})

const postCertificationsRoute = createRoute({
  method: 'post',
  path: '/{id}/certifications',
  tags: ['Admin'],
  summary: 'Replace user certifications (admin)',
  request: {
    params: z.object({ id: z.string() }),
    body: { content: { 'application/json': { schema: AdminUserCertificationsBodySchema } } },
  },
  responses: {
    200: {
      description: 'Updated user',
      content: { 'application/json': { schema: UserDTOSchema } },
    },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    403: {
      description: 'Forbidden',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    404: {
      description: 'Not found',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    500: {
      description: 'Server error',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
})

const postDeactivateRoute = createRoute({
  method: 'post',
  path: '/{id}/deactivate',
  tags: ['Admin'],
  summary: 'Deactivate user (admin)',
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: {
      description: 'Deactivated user',
      content: { 'application/json': { schema: UserDTOSchema } },
    },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    403: {
      description: 'Forbidden',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    404: {
      description: 'Not found',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    500: {
      description: 'Server error',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
})

const postRemoteWipeRoute = createRoute({
  method: 'post',
  path: '/{id}/remote-wipe',
  tags: ['Admin'],
  summary: 'Trigger remote wipe for inspector device (admin)',
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: {
      description: 'Remote wipe requested',
      content: { 'application/json': { schema: RemoteWipeTriggerResponseSchema } },
    },
    400: {
      description: 'Bad request',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    403: {
      description: 'Forbidden',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    404: {
      description: 'Not found',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    500: {
      description: 'Server error',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
})

const app = new OpenAPIHono()
  .openapi(createUserRoute, async (c) => {
    const body = c.req.valid('json')
    try {
      const { user, temporaryPassword } = await adminUserService.create(body)
      const dto = UserMapper.toDTO(user)
      return c.json(
        {
          user: { id: dto.id, email: dto.email, name: dto.name, role: dto.role },
          temporaryPassword,
        },
        201,
      ) as any
    } catch (e) {
      if (e instanceof Error) {
        if (e.message === 'Email already registered') {
          return c.json({ error: 'Conflict', message: e.message }, 409) as any
        }
        if (e.message === 'Owner accounts cannot be created from the admin portal') {
          return c.json({ error: 'Bad Request', message: e.message }, 400) as any
        }
      }
      throw e
    }
  })
  .openapi(listUsersRoute, async (c) => {
    const query = c.req.valid('query')
    const users = await adminUserService.list({
      role: query.role,
      isActive: query.isActive,
      search: query.search,
    })
    return c.json(users.map((u) => UserMapper.toDTO(u))) as any
  })
  .openapi(getUserRoute, async (c) => {
    const { id } = c.req.valid('param')
    const user = await adminUserService.getById(id)
    if (!user) {
      return c.json({ error: 'Not Found', message: 'User not found' }, 404)
    }
    return c.json(UserMapper.toDTO(user)) as any
  })
  .openapi(patchUserRoute, async (c) => {
    const { id } = c.req.valid('param')
    const body = c.req.valid('json')
    try {
      const user = await adminUserService.update(id, {
        name: body.name,
        designationId: body.designationId,
        disciplines: body.disciplines,
        authorities: body.authorities,
        certificationExpiry:
          body.certificationExpiry === undefined
            ? undefined
            : body.certificationExpiry === null
              ? null
              : new Date(body.certificationExpiry),
      })
      return c.json(UserMapper.toDTO(user)) as any
    } catch (e) {
      if (e instanceof Error && e.message === 'User not found') {
        return c.json({ error: 'Not Found', message: e.message }, 404)
      }
      throw e
    }
  })
  .openapi(postCertificationsRoute, async (c) => {
    const { id } = c.req.valid('param')
    const { certifications } = c.req.valid('json')
    try {
      const user = await adminUserService.updateCertifications(id, certifications)
      return c.json(UserMapper.toDTO(user)) as any
    } catch (e) {
      if (e instanceof Error && e.message === 'User not found') {
        return c.json({ error: 'Not Found', message: e.message }, 404)
      }
      throw e
    }
  })
  .openapi(postDeactivateRoute, async (c) => {
    const { id } = c.req.valid('param')
    try {
      const user = await adminUserService.deactivate(id)
      return c.json(UserMapper.toDTO(user)) as any
    } catch (e) {
      if (e instanceof Error && e.message === 'User not found') {
        return c.json({ error: 'Not Found', message: e.message }, 404)
      }
      throw e
    }
  })
  .openapi(postRemoteWipeRoute, async (c) => {
    const { id } = c.req.valid('param')
    const adminUserId = c.get('userId') as string
    try {
      const user = await remoteWipeService.requestRemoteWipe(id, adminUserId)
      const requestedAt = user.remoteWipeRequestedAt ?? new Date()
      return c.json({
        message: 'Remote wipe requested',
        requestedAt: requestedAt.toISOString(),
        userId: user.id,
      }) as any
    } catch (e) {
      if (e instanceof Error) {
        if (e.message === 'User not found') {
          return c.json({ error: 'Not Found', message: e.message }, 404)
        }
        if (e.message === 'Remote wipe is only supported for inspector (SCO) accounts') {
          return c.json({ error: 'Bad Request', message: e.message }, 400)
        }
      }
      throw e
    }
  })

export default app
