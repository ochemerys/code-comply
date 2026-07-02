import { computed } from 'vue'
import { useAuthStore } from '../stores/auth'
import { hasValidCertification } from '../lib/auth/certification'

/** Inspector (SCO) permissions — aligned with apps/api/src/middleware/role.ts (M11-S3). */
const SCO_PERMISSIONS = [
  'view_own_inspections',
  'create_deficiencies',
  'submit_voc',
  'view_own_reports',
] as const

export type InspectorPermission = (typeof SCO_PERMISSIONS)[number]

export function useRolePermissions() {
  const authStore = useAuthStore()

  const role = computed(() => authStore.user?.role)
  const isInspector = computed(() => role.value === 'SCO')
  const hasValidCert = computed(() => hasValidCertification(authStore.user))

  const permissions = computed(() => (isInspector.value ? [...SCO_PERMISSIONS] : []))

  function can(permission: InspectorPermission): boolean {
    return isInspector.value && SCO_PERMISSIONS.includes(permission)
  }

  /** Admin-only surfaces are never shown in the inspector PWA. */
  const showAdminFeatures = computed(() => false)

  return {
    role,
    isInspector,
    hasValidCert,
    permissions,
    can,
    showAdminFeatures,
  }
}
