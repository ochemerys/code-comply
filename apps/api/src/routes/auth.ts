import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import { z } from 'zod'
import {
  CertificationStatusDTOSchema,
  LoginDTOSchema,
  RefreshTokenDTOSchema,
  TokenDTOSchema,
  UserDTOSchema,
} from '@codecomply/validators'
import { authService } from '../services/auth.service.js'
import { certificationStatusService } from '../services/certification-status.service.js'
import { userService } from '../services/user.service.js'
import { UserMapper } from '../mappers/user.mapper.js'
import { authMiddleware } from '../middleware/auth.middleware.js'

const ErrorResponseSchema = z.object({
  error: z.string(),
})

const MessageResponseSchema = z.object({
  message: z.string(),
})

const loginRoute = createRoute({
  method: 'post',
  path: '/login',
  tags: ['Authentication'],
  summary: 'User login',
  description: 'Authenticate user with email and password',
  request: {
    body: {
      content: {
        'application/json': {
          schema: LoginDTOSchema,
          example: {
            email: 'inspector@example.com',
            password: 'password123',
          },
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Login successful',
      content: {
        'application/json': {
          schema: TokenDTOSchema,
          example: {
            accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.access',
            refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.refresh',
            expiresIn: 3600,
          },
        },
      },
    },
    401: {
      description: 'Invalid credentials',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
})

const refreshRoute = createRoute({
  method: 'post',
  path: '/refresh',
  tags: ['Authentication'],
  summary: 'Refresh access token',
  description: 'Refresh access token using refresh token',
  request: {
    body: {
      content: {
        'application/json': {
          schema: RefreshTokenDTOSchema,
          example: {
            refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example',
          },
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Token refreshed successfully',
      content: {
        'application/json': {
          schema: TokenDTOSchema,
        },
      },
    },
    401: {
      description: 'Invalid or expired refresh token',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
})

const logoutRoute = createRoute({
  method: 'post',
  path: '/logout',
  tags: ['Authentication'],
  summary: 'User logout',
  description: 'Logout user and invalidate session',
  responses: {
    200: {
      description: 'Logged out successfully',
      content: {
        'application/json': {
          schema: MessageResponseSchema,
        },
      },
    },
    401: {
      description: 'Unauthorized',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    500: {
      description: 'Logout failed',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
})

const meRoute = createRoute({
  method: 'get',
  path: '/me',
  tags: ['Authentication'],
  summary: 'Get current user profile',
  description: 'Get the profile of the currently authenticated user',
  responses: {
    200: {
      description: 'User profile retrieved successfully',
      content: {
        'application/json': {
          schema: UserDTOSchema,
        },
      },
    },
    401: {
      description: 'Unauthorized',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    404: {
      description: 'User not found',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    500: {
      description: 'Failed to fetch user',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
})

const certificationStatusRoute = createRoute({
  method: 'get',
  path: '/certification-status',
  tags: ['Authentication'],
  summary: 'Get certification revocation status',
  description:
    'Returns whether the authenticated inspector must re-authenticate due to revoked certification or deactivated account (M-01)',
  responses: {
    200: {
      description: 'Certification status',
      content: {
        'application/json': {
          schema: CertificationStatusDTOSchema,
        },
      },
    },
    401: {
      description: 'Unauthorized',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    404: {
      description: 'User not found',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
})

const authBase = new OpenAPIHono()

authBase.use('/logout', authMiddleware)
authBase.use('/me', authMiddleware)
authBase.use('/certification-status', authMiddleware)

const auth = authBase
  .openapi(loginRoute, async (c) => {
    try {
      const credentials = c.req.valid('json')
      const tokenPair = await authService.login(credentials)
      return c.json(tokenPair) as any
    } catch {
      return c.json({ error: 'Invalid credentials' }, 401) as any
    }
  })
  .openapi(refreshRoute, async (c) => {
    try {
      const { refreshToken } = c.req.valid('json')
      const tokenPair = await authService.refreshToken(refreshToken)
      return c.json(tokenPair) as any
    } catch {
      return c.json({ error: 'Invalid or expired refresh token' }, 401) as any
    }
  })
  .openapi(logoutRoute, async (c) => {
    try {
      const authHeader = c.req.header('Authorization')
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return c.json({ error: 'Unauthorized' }, 401) as any
      }

      const token = authHeader.substring(7)
      await authService.logout(token)

      return c.json({ message: 'Logged out successfully' }) as any
    } catch {
      return c.json({ error: 'Logout failed' }, 500) as any
    }
  })
  .openapi(meRoute, async (c) => {
    try {
      const userId = c.get('userId') as string
      const user = await userService.getById(userId)

      if (!user) {
        return c.json({ error: 'User not found' }, 404) as any
      }

      return c.json(UserMapper.toDTO(user)) as any
    } catch {
      return c.json({ error: 'Failed to fetch user' }, 500) as any
    }
  })
  .openapi(certificationStatusRoute, async (c) => {
    try {
      const userId = c.get('userId') as string
      const user = await userService.getById(userId)

      if (!user) {
        return c.json({ error: 'User not found' }, 404) as any
      }

      return c.json(certificationStatusService.getStatus(user)) as any
    } catch {
      return c.json({ error: 'Failed to fetch certification status' }, 500) as any
    }
  })

export default auth
