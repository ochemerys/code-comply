<script setup lang="ts">
export type UserFormModel = {
  name: string
  designationId: string
  disciplinesCsv: string
  authoritiesCsv: string
  certificationExpiry: string
}

const form = defineModel<UserFormModel>({ required: true })

defineProps<{
  email: string
  roleLabel: string
  disabled?: boolean
}>()
</script>

<template>
  <div data-testid="user-form" class="space-y-4">
    <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div>
        <label class="block text-sm font-medium text-text-secondary">Email</label>
        <p
          class="mt-1 rounded-md border border-border-subtle bg-bg-app px-3 py-2 text-sm text-text-primary"
          data-testid="user-form-email"
        >
          {{ email }}
        </p>
      </div>
      <div>
        <label class="block text-sm font-medium text-text-secondary">Role</label>
        <p
          class="mt-1 rounded-md border border-border-subtle bg-bg-app px-3 py-2 text-sm text-text-primary"
          data-testid="user-form-role"
        >
          {{ roleLabel }}
        </p>
      </div>
    </div>

    <div>
      <label class="block text-sm font-medium text-text-secondary" for="user-name">Name</label>
      <input
        id="user-name"
        v-model="form.name"
        type="text"
        class="mt-1 w-full max-w-xl rounded-md border border-border-strong px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        data-testid="user-form-name"
        :disabled="disabled"
      />
    </div>

    <div>
      <label class="block text-sm font-medium text-text-secondary" for="user-designation"
        >Designation ID</label
      >
      <input
        id="user-designation"
        v-model="form.designationId"
        type="text"
        class="mt-1 w-full max-w-xl rounded-md border border-border-strong px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        data-testid="user-form-designation"
        :disabled="disabled"
      />
    </div>

    <div
      class="space-y-4 rounded-lg border border-border-subtle bg-bg-app/60 p-4"
      data-testid="user-form-disciplines-authorities"
    >
      <p class="text-sm text-text-secondary">
        Disciplines and issuing authorities belong with the registry fields above—they define
        inspection coverage for assignments. Use comma or newline-separated values in each box.
      </p>

      <div>
        <label class="block text-sm font-medium text-text-secondary" for="user-disciplines">
          Inspection disciplines</label
        >
        <textarea
          id="user-disciplines"
          v-model="form.disciplinesCsv"
          rows="3"
          class="mt-1 w-full max-w-xl rounded-md border border-border-strong px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          data-testid="user-form-disciplines"
          :disabled="disabled"
          placeholder="e.g. Building, Electrical"
        />
      </div>

      <div>
        <label class="block text-sm font-medium text-text-secondary" for="user-authorities">
          Issuing authorities</label
        >
        <textarea
          id="user-authorities"
          v-model="form.authoritiesCsv"
          rows="3"
          class="mt-1 w-full max-w-xl rounded-md border border-border-strong px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          data-testid="user-form-authorities"
          :disabled="disabled"
          placeholder="e.g. Provincial safety codes authority"
        />
      </div>
    </div>

    <div>
      <label class="block text-sm font-medium text-text-secondary" for="user-cert-expiry"
        >Certification expiry (ISO)</label
      >
      <input
        id="user-cert-expiry"
        v-model="form.certificationExpiry"
        type="text"
        class="mt-1 w-full max-w-xl rounded-md border border-border-strong px-3 py-2 font-mono text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        placeholder="2028-01-01T00:00:00.000Z or leave empty"
        data-testid="user-form-cert-expiry"
        :disabled="disabled"
      />
    </div>
  </div>
</template>
