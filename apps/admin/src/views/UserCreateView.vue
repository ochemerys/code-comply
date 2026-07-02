<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import type { AdminCreateUserBody, CertificationDTO, UserRole } from '@codecomply/validators'
import { AdminCreateUserBodySchema } from '@codecomply/validators'
import CertificationEditor from '../components/CertificationEditor.vue'
import { useAdminCreateUser } from '../composables/useAdminCreateUser'

const router = useRouter()
const createUser = useAdminCreateUser()

const email = ref('')
const name = ref('')
const designationId = ref('')
const role = ref<UserRole>('SCO')
const disciplinesCsv = ref('')
const authoritiesCsv = ref('')
const certificationExpiry = ref('')
const certifications = ref<CertificationDTO[]>([])
const fieldErrors = ref<Record<string, string>>({})
const temporaryPassword = ref<string | null>(null)

const roleOptions: { value: UserRole; label: string }[] = [
  { value: 'SCO', label: 'SCO (Inspector)' },
  { value: 'ADMIN', label: 'Admin' },
]

const saving = computed(() => createUser.isPending.value)
const apiError = computed(() => {
  const e = createUser.error.value
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

function buildBody(): AdminCreateUserBody {
  const body: AdminCreateUserBody = {
    email: email.value.trim(),
    name: name.value.trim(),
    role: role.value,
    disciplines: parseCsv(disciplinesCsv.value),
    authorities: parseCsv(authoritiesCsv.value),
    certifications: normalizeCertifications(certifications.value),
  }
  const des = designationId.value.trim()
  if (des) body.designationId = des
  const exp = certificationExpiry.value.trim()
  if (exp) body.certificationExpiry = exp
  return body
}

async function submit() {
  fieldErrors.value = {}
  temporaryPassword.value = null
  const body = buildBody()
  const parsed = AdminCreateUserBodySchema.safeParse(body)
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = issue.path[0]?.toString() ?? 'form'
      fieldErrors.value[key] = issue.message
    }
    return
  }

  const result = await createUser.mutateAsync(parsed.data)
  if (result.temporaryPassword) {
    temporaryPassword.value = result.temporaryPassword
  } else {
    void router.push({ name: 'user-detail', params: { id: result.user.id } })
  }
}

function goToUser() {
  const id = createUser.data.value?.user.id
  if (id) void router.push({ name: 'user-detail', params: { id } })
}

function cancel() {
  void router.push({ name: 'users' })
}
</script>

<template>
  <div data-testid="user-create-view" class="space-y-8">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <button
          type="button"
          class="mb-2 text-sm font-medium text-primary-600 hover:text-primary-800"
          data-testid="user-create-back"
          @click="cancel"
        >
          ← Back to users
        </button>
        <p class="text-text-secondary">Register a new Safety Codes Officer in the registry</p>
      </div>
      <button
        type="button"
        class="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:opacity-50"
        data-testid="user-create-submit"
        :disabled="saving"
        @click="submit"
      >
        Create user
      </button>
    </div>

    <div
      v-if="apiError"
      class="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
      data-testid="user-create-api-error"
    >
      {{ apiError }}
    </div>

    <div
      v-if="temporaryPassword"
      class="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900"
      data-testid="user-create-temp-password"
    >
      <p class="font-semibold">User created. Share this one-time temporary password securely:</p>
      <p class="mt-2 font-mono text-base">{{ temporaryPassword }}</p>
      <button
        type="button"
        class="mt-3 text-sm font-medium text-primary-700 underline"
        data-testid="user-create-goto-detail"
        @click="goToUser"
      >
        Open user profile
      </button>
    </div>

    <section class="rounded-lg border border-border-subtle bg-bg-surface p-4 shadow-sm">
      <h3 class="mb-4 text-lg font-semibold text-text-primary">Account</h3>
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
        <label class="flex flex-col gap-1 text-sm">
          <span class="font-medium text-text-secondary">Email</span>
          <input
            v-model="email"
            type="email"
            class="rounded-md border border-border-strong px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            data-testid="user-create-email"
            autocomplete="off"
          />
          <span v-if="fieldErrors.email" class="text-red-600">{{ fieldErrors.email }}</span>
        </label>
        <label class="flex flex-col gap-1 text-sm">
          <span class="font-medium text-text-secondary">Role</span>
          <select
            v-model="role"
            class="rounded-md border border-border-strong px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            data-testid="user-create-role"
          >
            <option v-for="opt in roleOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
        </label>
        <label class="flex flex-col gap-1 text-sm md:col-span-2">
          <span class="font-medium text-text-secondary">Name</span>
          <input
            v-model="name"
            type="text"
            class="max-w-xl rounded-md border border-border-strong px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            data-testid="user-create-name"
          />
          <span v-if="fieldErrors.name" class="text-red-600">{{ fieldErrors.name }}</span>
        </label>
        <label class="flex flex-col gap-1 text-sm md:col-span-2">
          <span class="font-medium text-text-secondary">Designation ID</span>
          <input
            v-model="designationId"
            type="text"
            class="max-w-xl rounded-md border border-border-strong px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            data-testid="user-create-designation"
          />
        </label>
        <label class="flex flex-col gap-1 text-sm">
          <span class="font-medium text-text-secondary">Disciplines (comma-separated)</span>
          <textarea
            v-model="disciplinesCsv"
            rows="2"
            class="rounded-md border border-border-strong px-3 py-2 text-sm shadow-sm"
            data-testid="user-create-disciplines"
          />
        </label>
        <label class="flex flex-col gap-1 text-sm">
          <span class="font-medium text-text-secondary">Authorities (comma-separated)</span>
          <textarea
            v-model="authoritiesCsv"
            rows="2"
            class="rounded-md border border-border-strong px-3 py-2 text-sm shadow-sm"
            data-testid="user-create-authorities"
          />
        </label>
        <label class="flex flex-col gap-1 text-sm md:col-span-2">
          <span class="font-medium text-text-secondary">Certification expiry (ISO)</span>
          <input
            v-model="certificationExpiry"
            type="text"
            class="max-w-xl rounded-md border border-border-strong px-3 py-2 font-mono text-sm shadow-sm"
            placeholder="2028-01-01T00:00:00.000Z"
            data-testid="user-create-cert-expiry"
          />
          <span v-if="fieldErrors.certificationExpiry" class="text-red-600">{{
            fieldErrors.certificationExpiry
          }}</span>
        </label>
      </div>
    </section>

    <section class="rounded-lg border border-border-subtle bg-bg-surface p-4 shadow-sm">
      <h3 class="mb-3 text-lg font-semibold text-text-primary">Initial certifications</h3>
      <CertificationEditor v-model="certifications" />
    </section>
  </div>
</template>
