import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { runAdminPortalBeforeEach } from './guards/admin.guard'
import { lazyView } from '../lib/lazy-component'
import type { AdminPermission } from '../config/admin-navigation'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: lazyView(() => import('../views/LoginView.vue')),
    meta: { requiresAuth: false },
  },
  {
    path: '/reports/verify/:reportId',
    name: 'report-verify',
    component: lazyView(() => import('../views/ReportVerifyView.vue')),
    meta: { requiresAuth: false, title: 'Verify report' },
  },
  {
    path: '/',
    component: lazyView(() => import('../layouts/DashboardLayout.vue')),
    meta: { requiresAuth: true, requiresAdmin: true },
    children: [
      {
        path: '',
        name: 'dashboard',
        component: lazyView(() => import('../views/DashboardView.vue')),
        meta: { title: 'Dashboard' },
      },
      {
        path: 'assignments/grid',
        name: 'assignment-grid',
        component: lazyView(() => import('../views/AssignmentGridView.vue')),
        meta: {
          title: 'Assignment grid',
          requiredPermission: 'manage_assignments' as AdminPermission,
        },
      },
      {
        path: 'assignments/calendar',
        name: 'workload-calendar',
        component: lazyView(() => import('../views/WorkloadCalendarView.vue')),
        meta: {
          title: 'Workload calendar',
          requiredPermission: 'manage_assignments' as AdminPermission,
        },
      },
      {
        path: 'assignments/bulk',
        name: 'bulk-assignment',
        component: lazyView(() => import('../views/BulkAssignmentView.vue')),
        meta: {
          title: 'Bulk assignment',
          requiredPermission: 'manage_assignments' as AdminPermission,
        },
      },
      {
        path: 'users/new',
        name: 'user-create',
        component: lazyView(() => import('../views/UserCreateView.vue')),
        meta: { title: 'Add SCO', requiredPermission: 'manage_users' as AdminPermission },
      },
      {
        path: 'users/:id',
        name: 'user-detail',
        component: lazyView(() => import('../views/UserDetailView.vue')),
        meta: { title: 'User details', requiredPermission: 'manage_users' as AdminPermission },
      },
      {
        path: 'users',
        name: 'users',
        component: lazyView(() => import('../views/UserListView.vue')),
        meta: { title: 'Users', requiredPermission: 'manage_users' as AdminPermission },
      },
      {
        path: 'permits',
        name: 'permits',
        component: lazyView(() => import('../views/PermitsView.vue')),
        meta: {
          title: 'Permit management',
          requiredPermission: 'view_all_inspections' as AdminPermission,
        },
      },
      {
        path: 'permits/:id',
        name: 'permit-detail',
        component: lazyView(() => import('../views/AdminPermitDetailView.vue')),
        meta: {
          title: 'Permit triage',
          requiredPermission: 'view_all_inspections' as AdminPermission,
        },
      },
      {
        path: 'inspections',
        name: 'inspections',
        redirect: { name: 'inspection-monitor' },
      },
      {
        path: 'inspections/monitor',
        name: 'inspection-monitor',
        component: lazyView(() => import('../views/InspectionMonitorView.vue')),
        meta: {
          title: 'Inspection monitor',
          requiredPermission: 'view_all_inspections' as AdminPermission,
        },
      },
      {
        path: 'inspections/:id',
        name: 'inspection-detail',
        component: lazyView(() => import('../views/InspectionDetailView.vue')),
        meta: {
          title: 'Inspection workflow',
          requiredPermission: 'view_all_inspections' as AdminPermission,
        },
      },
      {
        path: 'inspections/:id/documents',
        name: 'inspection-documents',
        component: lazyView(() => import('../views/DocumentHubView.vue')),
        meta: {
          title: 'Document hub',
          requiredPermission: 'view_all_inspections' as AdminPermission,
        },
      },
      {
        path: 'orders',
        name: 'orders',
        component: lazyView(() => import('../views/OrdersListView.vue')),
        meta: {
          title: 'Stop Work orders',
          requiredPermission: 'view_all_inspections' as AdminPermission,
        },
      },
      {
        path: 'orders/:deficiencyId',
        name: 'order-detail',
        component: lazyView(() => import('../views/OrderDetailView.vue')),
        meta: {
          title: 'Order detail',
          requiredPermission: 'view_all_inspections' as AdminPermission,
        },
      },
      {
        path: 'reports',
        name: 'reports',
        component: lazyView(() => import('../views/ReportGenerationView.vue')),
        meta: { title: 'Reports', requiredPermission: 'generate_reports' as AdminPermission },
      },
      {
        path: 'compliance/voc',
        name: 'voc-review',
        component: lazyView(() => import('../views/VoCReviewView.vue')),
        meta: { title: 'VoC review queue', requiredPermission: 'review_voc' as AdminPermission },
      },
      {
        path: 'compliance/search',
        name: 'compliance-search',
        component: lazyView(() => import('../views/ComplianceSearchView.vue')),
        meta: {
          title: 'Compliance search',
          requiredPermission: 'view_all_inspections' as AdminPermission,
        },
      },
      {
        path: 'compliance/deficiencies',
        name: 'deficiencies',
        component: lazyView(() => import('../views/DeficiencyListView.vue')),
        meta: {
          title: 'Deficiencies',
          requiredPermission: 'view_all_inspections' as AdminPermission,
        },
      },
      {
        path: 'compliance/deficiencies/new',
        name: 'deficiency-create',
        component: lazyView(() => import('../views/DeficiencyCreateView.vue')),
        meta: {
          title: 'Create deficiency',
          requiredPermission: 'view_all_inspections' as AdminPermission,
        },
      },
      {
        path: 'compliance/deficiencies/:id',
        name: 'deficiency-detail',
        component: lazyView(() => import('../views/DeficiencyDetailView.vue')),
        meta: {
          title: 'Deficiency detail',
          requiredPermission: 'view_all_inspections' as AdminPermission,
        },
      },
      {
        path: 'compliance/records/:id',
        name: 'inspection-record',
        component: lazyView(() => import('../views/InspectionRecordDetailView.vue')),
        meta: {
          title: 'Inspection record',
          requiredPermission: 'view_all_inspections' as AdminPermission,
        },
      },
      {
        path: 'configuration/templates',
        name: 'checklist-templates',
        component: lazyView(() => import('../views/ChecklistTemplatesView.vue')),
        meta: {
          title: 'Checklist templates',
          requiredPermission: 'view_all_inspections' as AdminPermission,
        },
      },
      {
        path: 'configuration/templates/new',
        name: 'checklist-template-new',
        component: lazyView(() => import('../views/ChecklistTemplateEditorView.vue')),
        meta: {
          title: 'New checklist template',
          requiredPermission: 'view_all_inspections' as AdminPermission,
        },
      },
      {
        path: 'configuration/templates/:id',
        name: 'checklist-template-edit',
        component: lazyView(() => import('../views/ChecklistTemplateEditorView.vue')),
        meta: {
          title: 'Edit checklist template',
          requiredPermission: 'view_all_inspections' as AdminPermission,
        },
      },
      {
        path: 'configuration/codes',
        name: 'code-library',
        component: lazyView(() => import('../views/CodeLibraryView.vue')),
        meta: {
          title: 'Code library',
          requiredPermission: 'view_all_inspections' as AdminPermission,
        },
      },
      {
        path: 'settings',
        name: 'settings',
        component: lazyView(() => import('../views/SettingsView.vue')),
        meta: { title: 'Settings' },
      },
    ],
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

router.beforeEach((to, _from, next) => {
  const authStore = useAuthStore()
  runAdminPortalBeforeEach(to, authStore, next)
})

export default router
