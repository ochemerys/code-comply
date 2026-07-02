<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { CertificationDTO, UserDTO } from '@codecomply/validators'
import UserForm, { type UserFormModel } from '../components/UserForm.vue'
import CertificationEditor from '../components/CertificationEditor.vue'
import ScoAssignmentReadiness from '../components/ScoAssignmentReadiness.vue'
import {
  useAdminUserDetail,
  isSessionExpiredRedirectError,
} from '../composables/useAdminUserDetail'
import { useAdminPermissions } from '../composables/useAdminPermissions'

const route = useRoute()
const router = useRouter()
const { can } = useAdminPermissions()

const userId = computed(() => String(route.params.id ?? ''))
const canManageUsers = computed(() => can('manage_users'))

const { userQuery, patchUser, saveCertifications, deactivateUser, remoteWipeUser } =
  useAdminUserDetail(userId)

const user = computed(() => userQuery.data.value)

const form = ref<UserFormModel>({
  name: '',
  designationId: '',
  disciplinesCsv: '',
  authoritiesCsv: '',
  certificationExpiry: '',
})

const certifications = ref<CertificationDTO[]>([])
const plannedInspectionDate = ref('2026-06-10')

function applyUserToForm(u: UserDTO) {
  form.value = {
    name: u.name,
    designationId: u.designationId ?? '',
    disciplinesCsv: (u.disciplines ?? []).join(', '),
    authoritiesCsv: (u.authorities ?? []).join(', '),
    certificationExpiry: u.certificationExpiry ?? '',
  }
  certifications.value = (
    u.certifications
      ? u.certifications.map((c) => ({
          ...c,
          expiryDate: c.expiryDate ?? '',
        }))
      : []
  ) as CertificationDTO[]
}

watch(
  user,
  (u) => {
    if (u) applyUserToForm(u)
  },
  { immediate: true },
)

const loading = computed(() => userQuery.isPending.value || userQuery.isFetching.value)
const showFetchError = computed(
  () => !!userQuery.error.value && !isSessionExpiredRedirectError(userQuery.error.value),
)
const errorMessage = computed(() => {
  const e = userQuery.error.value
  return e instanceof Error ? e.message : e ? String(e) : ''
})

function parseCsv(value: string): string[] {
  return value
    .split(/[,\n]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function normalizeCertifications(list: CertificationDTO[]): CertificationDTO[] {
  return list
    .filter((c) => c.discipline.trim() && c.authority.trim() && c.issuedDate.trim())
    .map((c) => {
      const base = {
        id: c.id,
        discipline: c.discipline.trim(),
        authority: c.authority.trim(),
        issuedDate: c.issuedDate.trim(),
        status: c.status,
      }
      const exp = c.expiryDate?.trim()
      return (exp ? { ...base, expiryDate: exp } : base) as CertificationDTO
    })
}

const savingProfile = computed(() => patchUser.isPending.value)
const savingCerts = computed(() => saveCertifications.isPending.value)
const deactivating = computed(() => deactivateUser.isPending.value)
const remoteWiping = computed(() => remoteWipeUser.isPending.value)

async function saveProfile() {
  const f = form.value
  const exp = f.certificationExpiry.trim()
  await patchUser.mutateAsync({
    name: f.name.trim(),
    designationId: f.designationId.trim() || null,
    disciplines: parseCsv(f.disciplinesCsv),
    authorities: parseCsv(f.authoritiesCsv),
    certificationExpiry: exp === '' ? null : exp,
  })
}

async function saveCerts() {
  await saveCertifications.mutateAsync(normalizeCertifications(certifications.value))
}

async function deactivate() {
  if (!window.confirm('Deactivate this user? They will no longer receive assignments.')) return
  await deactivateUser.mutateAsync()
}

async function remoteWipe() {
  if (
    !window.confirm(
      'Trigger remote wipe for this inspector device? All local app data will be cleared on next open and they will be signed out.',
    )
  ) {
    return
  }
  await remoteWipeUser.mutateAsync()
}

function goBack() {
  void router.push({ name: 'users' })
}
</script>

<template>
  <div data-testid="user-detail-view" class="space-y-8">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <button
          type="button"
          class="mb-2 text-sm font-medium text-primary-600 hover:text-primary-800"
          data-testid="user-detail-back"
          @click="goBack"
        >
          ← Back to users
        </button>
        <p class="text-text-secondary">
          Review registry fields, certifications, and lifecycle actions
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          class="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:opacity-50"
          data-testid="user-detail-save-profile"
          :disabled="savingProfile || loading || userQuery.isError.value"
          @click="saveProfile"
        >
          Save profile
        </button>
        <button
          type="button"
          class="rounded-lg border border-border-strong bg-bg-surface px-4 py-2 text-sm font-semibold text-text-primary shadow-sm hover:bg-bg-app disabled:opacity-50"
          data-testid="user-detail-save-certs"
          :disabled="savingCerts || loading || userQuery.isError.value"
          @click="saveCerts"
        >
          Save certifications
        </button>
        <button
          v-if="canManageUsers"
          type="button"
          class="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-800 hover:bg-red-100 disabled:opacity-50"
          data-testid="user-detail-deactivate"
          :disabled="deactivating || loading || userQuery.isError.value || user?.isActive === false"
          @click="deactivate"
        >
          Deactivate
        </button>
        <button
          v-if="canManageUsers && user?.role === 'SCO'"
          type="button"
          class="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-50"
          data-testid="user-detail-remote-wipe"
          :disabled="remoteWiping || loading || userQuery.isError.value"
          @click="remoteWipe"
        >
          Remote wipe device
        </button>
      </div>
    </div>

    <div
      v-if="showFetchError"
      class="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
      data-testid="user-detail-error"
    >
      {{ errorMessage }}
    </div>

    <div
      v-if="loading && !user"
      class="rounded-lg border border-border-subtle bg-bg-app px-4 py-8 text-center text-text-secondary"
      data-testid="user-detail-loading"
    >
      Loading user…
    </div>

    <template v-else-if="user">
      <section
        class="rounded-lg border border-border-subtle bg-bg-surface p-4 shadow-sm"
        data-testid="user-detail-basic"
      >
        <h3 class="mb-3 text-lg font-semibold text-text-primary">Basic information</h3>
        <UserForm
          v-model="form"
          :email="user.email"
          :role-label="user.role"
          :disabled="savingProfile || deactivating"
        />
      </section>

      <section
        class="rounded-lg border border-border-subtle bg-bg-surface p-4 shadow-sm"
        data-testid="user-detail-certifications"
      >
        <h3 class="mb-3 text-lg font-semibold text-text-primary">Certifications</h3>
        <CertificationEditor v-model="certifications" />
      </section>

      <ScoAssignmentReadiness
        v-if="user.role === 'SCO'"
        v-model:planned-date="plannedInspectionDate"
        :user="user"
      />

      <section
        class="rounded-lg border border-border-subtle bg-bg-surface p-4 shadow-sm"
        data-testid="user-detail-activity"
      >
        <h3 class="mb-3 text-lg font-semibold text-text-primary">Activity history</h3>
        <dl class="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt class="font-medium text-text-dim">Created</dt>
            <dd class="text-text-primary">
              {{ user.createdAt }}
            </dd>
          </div>
          <div>
            <dt class="font-medium text-text-dim">Updated</dt>
            <dd class="text-text-primary">
              {{ user.updatedAt }}
            </dd>
          </div>
          <div>
            <dt class="font-medium text-text-dim">Last login</dt>
            <dd class="text-text-primary">
              {{ user.lastLoginAt ?? '—' }}
            </dd>
          </div>
          <div>
            <dt class="font-medium text-text-dim">Account status</dt>
            <dd class="text-text-primary">
              <span v-if="user.isActive === false" class="text-red-700">Inactive</span>
              <span v-else class="text-green-700">Active</span>
              <span v-if="user.deactivatedAt" class="ml-2 text-text-secondary"
                >(since {{ user.deactivatedAt }})</span
              >
            </dd>
          </div>
        </dl>
      </section>
    </template>
  </div>
</template>
