import { OpenAPIHono } from '@hono/zod-openapi'
import { swaggerUI } from '@hono/swagger-ui'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { prettyJSON } from 'hono/pretty-json'
import healthRoutes from './routes/health.js'
import authRoutes from './routes/auth.js'
import ssoRoutes from './routes/auth-sso.js'
import syncRoutes from './routes/sync.js'
import permitsRoutes from './routes/permits.js'
import inspectionsRoutes from './routes/inspections.js'
import checklistsRoutes from './routes/checklists.js'
import codesRoutes from './routes/codes.js'
import deficienciesRoutes from './routes/deficiencies.js'
import documentsRoutes from './routes/documents.js'
import reportsRoutes from './routes/reports.js'
import reportsVerifyRoutes from './routes/reports-verify.js'
import adminReportsRoutes from './routes/admin/reports.js'
import vocRoutes from './routes/voc.js'
import photosRoutes from './routes/photos.js'
import adminUsersRoutes from './routes/admin/users.js'
import adminAssignmentsRoutes from './routes/admin/assignments.js'
import adminComplianceSearchRoutes from './routes/admin/compliance-search.js'
import adminPermitsRoutes from './routes/admin/permits.js'
import adminChecklistTemplatesRoutes from './routes/admin/checklist-templates.js'
import adminCodeLibraryRoutes from './routes/admin/code-library.js'
import adminOrdersRoutes from './routes/admin/orders.js'
import adminSettingsRoutes from './routes/admin/settings.js'
import adminInspectionsRoutes from './routes/admin/inspections.js'
import adminDocumentsRoutes from './routes/admin/documents.js'
import adminAuditLogsRoutes from './routes/admin/audit-logs.js'
import './register-order-escalation-hooks.js'
import deviceRemoteWipeRoutes from './routes/device/remote-wipe.js'
import notificationsRoutes from './routes/notifications.js'
import { authMiddleware } from './middleware/auth.middleware.js'
import { roleMiddleware, requirePermission, ADMIN_ROUTE_PERMISSIONS } from './middleware/role.js'
import { securityMiddleware } from './middleware/security.js'
import { securityHeadersMiddleware } from './middleware/security-headers.js'
import { inputSanitizationMiddleware } from './middleware/input-sanitization.js'
import {
  apiRateLimitMiddleware,
  loginRateLimitMiddleware,
  uploadRateLimitMiddleware,
} from './middleware/rate-limit.js'
import { remoteWipePendingMiddleware } from './middleware/remote-wipe-pending.js'
import { requestTimingMiddleware } from './middleware/request-timing.js'
import { captureException } from './lib/sentry.js'
import { readDevStorageObject, type StorageBucketKind } from './lib/storage/storage-client.js'

// Create OpenAPI-enabled app
const app = new OpenAPIHono()

import { resolveCorsOrigin } from './lib/cors-config.js'

app.openAPIRegistry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
  description:
    'JWT access token obtained from POST /auth/login. Send as `Authorization: Bearer <token>`.',
})

const adminRoutes = new OpenAPIHono()
adminRoutes.use('*', roleMiddleware(['ADMIN']))
adminRoutes.use('/users/*', requirePermission(ADMIN_ROUTE_PERMISSIONS.users))
adminRoutes.use('/assignments/*', requirePermission(ADMIN_ROUTE_PERMISSIONS.assignments))
adminRoutes.use('/compliance-search/*', requirePermission(ADMIN_ROUTE_PERMISSIONS.complianceSearch))
adminRoutes.use('/permits/*', requirePermission(ADMIN_ROUTE_PERMISSIONS.complianceSearch))
adminRoutes.use(
  '/checklist-templates/*',
  requirePermission(ADMIN_ROUTE_PERMISSIONS.complianceSearch),
)
adminRoutes.use('/code-library/*', requirePermission(ADMIN_ROUTE_PERMISSIONS.complianceSearch))
adminRoutes.use('/orders/*', requirePermission(ADMIN_ROUTE_PERMISSIONS.complianceSearch))
adminRoutes.use('/reports/*', requirePermission(ADMIN_ROUTE_PERMISSIONS.reports))
adminRoutes.use('/settings/*', requirePermission(ADMIN_ROUTE_PERMISSIONS.users))
adminRoutes.use('/inspections/*', requirePermission(ADMIN_ROUTE_PERMISSIONS.complianceSearch))
adminRoutes.use('/documents/*', requirePermission(ADMIN_ROUTE_PERMISSIONS.complianceSearch))
adminRoutes.use('/audit-logs/*', requirePermission(ADMIN_ROUTE_PERMISSIONS.complianceSearch))
adminRoutes.route('/users', adminUsersRoutes)
adminRoutes.route('/settings', adminSettingsRoutes)
adminRoutes.route('/inspections', adminInspectionsRoutes)
adminRoutes.route('/assignments', adminAssignmentsRoutes)
adminRoutes.route('/permits', adminPermitsRoutes)
adminRoutes.route('/checklist-templates', adminChecklistTemplatesRoutes)
adminRoutes.route('/code-library', adminCodeLibraryRoutes)
adminRoutes.route('/orders', adminOrdersRoutes)
adminRoutes.route('/reports', adminReportsRoutes)
adminRoutes.route('/documents', adminDocumentsRoutes)
adminRoutes.route('/compliance-search', adminComplianceSearchRoutes)
adminRoutes.route('/audit-logs', adminAuditLogsRoutes)

// Global middleware
app.use(requestTimingMiddleware)
app.use(logger())
app.use(prettyJSON())
app.use(securityMiddleware())
app.use(securityHeadersMiddleware())
app.use(inputSanitizationMiddleware())
app.use(
  cors({
    origin: (origin) => resolveCorsOrigin(origin),
    credentials: true,
  }),
)

// OpenAPI documentation
app.doc('/openapi.json', {
  openapi: '3.0.0',
  info: {
    version: '1.0.0',
    title: 'CodeComply Connect API',
    description:
      'API for managing safety codes inspections, deficiencies, and compliance documentation',
  },
  servers: [
    {
      url: 'http://localhost:4000',
      description: 'Local development server',
    },
  ],
  tags: [
    {
      name: 'Health',
      description: 'Health check endpoints',
    },
    {
      name: 'Authentication',
      description: 'User authentication and authorization',
    },
    {
      name: 'Sync',
      description: 'Data synchronization endpoints for offline-first functionality',
    },
    {
      name: 'Permits',
      description: 'Permit management and GPS-based discovery',
    },
    {
      name: 'Inspections',
      description: 'Inspection management and execution',
    },
    {
      name: 'Checklists',
      description: 'Checklist templates and field execution',
    },
    {
      name: 'Codes',
      description: 'Safety code library search and lookup',
    },
    {
      name: 'Deficiencies',
      description: 'Deficiency CRUD and Stop Work orders',
    },
    {
      name: 'Documents',
      description: 'Inspection evidence file upload, signed URLs, and deletion',
    },
    {
      name: 'Reports',
      description: 'PDF report generation, R2 storage, and signed download URLs (M10)',
    },
    {
      name: 'VoC',
      description: 'Verification of Compliance submission, admin review, and pending queue (M10)',
    },
    {
      name: 'Photos',
      description:
        'Inspection evidence photos — multipart upload, object storage, and deletion (M7-S19)',
    },
    {
      name: 'Admin',
      description: 'Admin portal — user registry, certifications, and inspection assignments (M9)',
    },
    {
      name: 'Notifications',
      description: 'Web Push subscriptions and test dispatch (NFR-M-04)',
    },
  ],
})

// Swagger UI
app.get('/swagger', swaggerUI({ url: '/openapi.json' }))

// Public routes
app.route('/health', healthRoutes)
app.use('/auth/login', loginRateLimitMiddleware())
app.route('/auth', authRoutes)
app.route('/auth', ssoRoutes)

/** Development-only download for in-memory object storage (no auth — mirrors presigned R2 URLs). */
if (process.env.NODE_ENV !== 'production') {
  app.get('/dev/storage/:kind/*', async (c) => {
    const kind = c.req.param('kind')
    if (kind !== 'photos' && kind !== 'documents') {
      return c.json({ error: 'Invalid storage kind' }, 400)
    }
    const prefix = `/dev/storage/${kind}/`
    const path = c.req.path
    const slashIdx = path.indexOf(prefix)
    if (slashIdx < 0) {
      return c.json({ error: 'Not Found' }, 404)
    }
    const encodedSegments = path.slice(slashIdx + prefix.length)
    if (!encodedSegments) {
      return c.json({ error: 'Not Found' }, 404)
    }
    const key = encodedSegments
      .split('/')
      .map((segment) => decodeURIComponent(segment))
      .join('/')
    try {
      const { bytes, contentType } = await readDevStorageObject(kind as StorageBucketKind, key)
      return c.body(Buffer.from(bytes), 200, { 'Content-Type': contentType })
    } catch {
      return c.json({ error: 'Not Found' }, 404)
    }
  })
}

// Public report verification (hash check for QR links)
app.route('/api/reports', reportsVerifyRoutes)

// Protected routes
app.use('/api/*', authMiddleware)
app.use('/api/*', remoteWipePendingMiddleware)
app.use('/api/*', apiRateLimitMiddleware())
app.use('/api/photos/*', uploadRateLimitMiddleware())
app.use('/api/documents/*', uploadRateLimitMiddleware())
app.route('/api/sync', syncRoutes)
app.route('/api/permits', permitsRoutes)
app.route('/api/inspections', inspectionsRoutes)
app.route('/api/checklists', checklistsRoutes)
app.route('/api/codes', codesRoutes)
app.route('/api/deficiencies', deficienciesRoutes)
app.route('/api/documents', documentsRoutes)
app.route('/api/reports', reportsRoutes)
app.route('/api/voc', vocRoutes)
app.route('/api/photos', photosRoutes)
app.route('/api/device/remote-wipe', deviceRemoteWipeRoutes)
app.route('/api/notifications', notificationsRoutes)
app.route('/api/admin', adminRoutes)

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not Found' }, 404)
})

// Error handler
app.onError((err, c) => {
  console.error('Unhandled error:', err)
  captureException(err)
  return c.json({ error: 'Internal Server Error' }, 500)
})

export { app }
