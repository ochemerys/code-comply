export type AdminNavIcon =
  | 'home'
  | 'users'
  | 'file'
  | 'clipboard'
  | 'calendar'
  | 'chart'
  | 'settings'
  | 'shieldCheck'
  | 'search'

export interface AdminNavItem {
  label: string
  icon: AdminNavIcon
  route: string
  /** RBAC permission required (M11-S3); omitted items are visible to all admins. */
  requiredPermission?: AdminPermission
}

/**
 * Admin permission strings — keep aligned with
 * `ADMIN_PERMISSIONS` and `ADMIN_ROUTE_PERMISSIONS` in
 * `apps/api/src/middleware/role.ts` (M11-S3).
 */
export const ADMIN_PERMISSIONS = [
  'view_all_inspections',
  'manage_users',
  'review_voc',
  'generate_reports',
  'manage_assignments',
] as const

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number]

/** API route-group permissions — cross-check in route-permissions.spec.ts */
export const API_ROUTE_GROUP_PERMISSIONS = {
  users: 'manage_users',
  assignments: 'manage_assignments',
  complianceSearch: 'view_all_inspections',
  vocReview: 'review_voc',
  reports: 'generate_reports',
} as const satisfies Record<string, AdminPermission>

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { label: 'Dashboard', icon: 'home', route: '/' },
  { label: 'Users', icon: 'users', route: '/users', requiredPermission: 'manage_users' },
  { label: 'Permits', icon: 'file', route: '/permits', requiredPermission: 'view_all_inspections' },
  {
    label: 'VoC review',
    icon: 'shieldCheck',
    route: '/compliance/voc',
    requiredPermission: 'review_voc',
  },
  {
    label: 'Compliance search',
    icon: 'search',
    route: '/compliance/search',
    requiredPermission: 'view_all_inspections',
  },
  {
    label: 'Deficiencies',
    icon: 'clipboard',
    route: '/compliance/deficiencies',
    requiredPermission: 'view_all_inspections',
  },
  {
    label: 'Inspection monitor',
    icon: 'clipboard',
    route: '/inspections/monitor',
    requiredPermission: 'view_all_inspections',
  },
  {
    label: 'Stop Work orders',
    icon: 'shieldCheck',
    route: '/orders',
    requiredPermission: 'view_all_inspections',
  },
  {
    label: 'Assignments',
    icon: 'calendar',
    route: '/assignments/grid',
    requiredPermission: 'manage_assignments',
  },
  {
    label: 'Bulk assignment',
    icon: 'clipboard',
    route: '/assignments/bulk',
    requiredPermission: 'manage_assignments',
  },
  {
    label: 'Workload calendar',
    icon: 'chart',
    route: '/assignments/calendar',
    requiredPermission: 'manage_assignments',
  },
  { label: 'Reports', icon: 'chart', route: '/reports', requiredPermission: 'generate_reports' },
  {
    label: 'Checklist templates',
    icon: 'clipboard',
    route: '/configuration/templates',
    requiredPermission: 'view_all_inspections',
  },
  {
    label: 'Code library',
    icon: 'file',
    route: '/configuration/codes',
    requiredPermission: 'view_all_inspections',
  },
  { label: 'Settings', icon: 'settings', route: '/settings' },
]
