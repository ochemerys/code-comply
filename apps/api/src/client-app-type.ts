/**
 * Route tree used only for Hono RPC typing (`hc<AppType>`).
 * Mirrors apps/api/src/app.ts mounted paths; keep in sync when adding API routes.
 */
import { OpenAPIHono } from '@hono/zod-openapi'
import authRoutes from './routes/auth.js'
import syncRoutes from './routes/sync.js'
import permitsClientRoutes from './routes/permits-client-routes.js'
import inspectionsClientRoutes from './routes/inspections-client-routes.js'
import checklistsRoutes from './routes/checklists.js'
import codesRoutes from './routes/codes.js'
import deficienciesRoutes from './routes/deficiencies.js'
import documentsClientRoutes from './routes/documents-client-routes.js'
import reportsRoutes from './routes/reports.js'
import vocRoutes from './routes/voc.js'
import photosRoutes from './routes/photos.js'
import deviceRemoteWipeRoutes from './routes/device/remote-wipe.js'
import notificationsRoutes from './routes/notifications.js'
import adminUsersRoutes from './routes/admin/users.js'
import adminAssignmentsClientRoutes from './routes/admin-assignments-client-routes.js'
import adminComplianceSearchRoutes from './routes/admin/compliance-search.js'
import adminPermitsClientRoutes from './routes/admin-permits-client-routes.js'
import adminChecklistTemplatesRoutes from './routes/admin/checklist-templates.js'
import adminCodeLibraryRoutes from './routes/admin/code-library.js'
import adminOrdersRoutes from './routes/admin/orders.js'
import adminReportsRoutes from './routes/admin/reports.js'
import adminSettingsRoutes from './routes/admin/settings.js'
import adminInspectionsRoutes from './routes/admin/inspections.js'
import adminDocumentsRoutes from './routes/admin/documents.js'
import adminAuditLogsRoutes from './routes/admin/audit-logs.js'
import reportsVerifyRoutes from './routes/reports-verify.js'

const adminRoutes = new OpenAPIHono()
  .route('/users', adminUsersRoutes)
  .route('/settings', adminSettingsRoutes)
  .route('/inspections', adminInspectionsRoutes)
  .route('/assignments', adminAssignmentsClientRoutes)
  .route('/permits', adminPermitsClientRoutes)
  .route('/checklist-templates', adminChecklistTemplatesRoutes)
  .route('/code-library', adminCodeLibraryRoutes)
  .route('/orders', adminOrdersRoutes)
  .route('/reports', adminReportsRoutes)
  .route('/documents', adminDocumentsRoutes)
  .route('/compliance-search', adminComplianceSearchRoutes)
  .route('/audit-logs', adminAuditLogsRoutes)

/** Chained mount tree for RPC — sub-routers use reassigned `.openapi()` for schema inference. */
const clientApp = new OpenAPIHono()
  .route('/auth', authRoutes)
  .route('/api/sync', syncRoutes)
  .route('/api/permits', permitsClientRoutes)
  .route('/api/inspections', inspectionsClientRoutes)
  .route('/api/checklists', checklistsRoutes)
  .route('/api/codes', codesRoutes)
  .route('/api/deficiencies', deficienciesRoutes)
  .route('/api/documents', documentsClientRoutes)
  .route('/api/reports', reportsRoutes)
  .route('/api/reports', reportsVerifyRoutes)
  .route('/api/voc', vocRoutes)
  .route('/api/photos', photosRoutes)
  .route('/api/device/remote-wipe', deviceRemoteWipeRoutes)
  .route('/api/notifications', notificationsRoutes)
  .route('/api/admin', adminRoutes)

export type AppType = typeof clientApp
