<script setup lang="ts">
import type { CertificationDTO } from '@codecomply/validators'

const model = defineModel<CertificationDTO[]>({ required: true })

function addRow() {
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `cert-${Date.now()}`
  model.value = [
    ...model.value,
    {
      id,
      discipline: '',
      authority: '',
      issuedDate: new Date().toISOString().slice(0, 19) + 'Z',
      status: 'ACTIVE',
    },
  ]
}

function removeAt(index: number) {
  model.value = model.value.filter((_, i) => i !== index)
}
</script>

<template>
  <div data-testid="certification-editor" class="space-y-3">
    <div class="overflow-x-auto rounded-lg border border-border-subtle">
      <table class="min-w-full divide-y divide-border-subtle text-left text-sm">
        <thead class="bg-bg-app">
          <tr>
            <th class="px-3 py-2 font-semibold text-text-secondary">Discipline</th>
            <th class="px-3 py-2 font-semibold text-text-secondary">Authority</th>
            <th class="px-3 py-2 font-semibold text-text-secondary">Issued (ISO)</th>
            <th class="px-3 py-2 font-semibold text-text-secondary">Expiry (ISO)</th>
            <th class="px-3 py-2 font-semibold text-text-secondary">Status</th>
            <th class="px-3 py-2 font-semibold text-text-secondary" />
          </tr>
        </thead>
        <tbody class="divide-y divide-border-subtle bg-bg-surface">
          <tr v-for="(row, index) in model" :key="row.id">
            <td class="px-2 py-2">
              <input
                v-model="row.discipline"
                type="text"
                class="w-full min-w-[8rem] rounded border border-border-strong px-2 py-1 text-sm"
                :data-testid="`cert-discipline-${index}`"
              />
            </td>
            <td class="px-2 py-2">
              <input
                v-model="row.authority"
                type="text"
                class="w-full min-w-[8rem] rounded border border-border-strong px-2 py-1 text-sm"
                :data-testid="`cert-authority-${index}`"
              />
            </td>
            <td class="px-2 py-2">
              <input
                v-model="row.issuedDate"
                type="text"
                class="w-full min-w-[12rem] rounded border border-border-strong px-2 py-1 font-mono text-xs"
                :data-testid="`cert-issued-${index}`"
              />
            </td>
            <td class="px-2 py-2">
              <input
                v-model="row.expiryDate"
                type="text"
                class="w-full min-w-[12rem] rounded border border-border-strong px-2 py-1 font-mono text-xs"
                placeholder="optional"
                :data-testid="`cert-expiry-${index}`"
              />
            </td>
            <td class="px-2 py-2">
              <select
                v-model="row.status"
                class="rounded border border-border-strong px-2 py-1 text-sm"
                :data-testid="`cert-status-${index}`"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="EXPIRED">EXPIRED</option>
                <option value="REVOKED">REVOKED</option>
              </select>
            </td>
            <td class="px-2 py-2">
              <button
                type="button"
                class="text-sm text-red-600 hover:text-red-800"
                :data-testid="`cert-remove-${index}`"
                @click="removeAt(index)"
              >
                Remove
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <button
      type="button"
      class="rounded-md border border-border-strong bg-bg-surface px-3 py-1.5 text-sm font-medium text-text-primary shadow-sm hover:bg-bg-app"
      data-testid="certification-add"
      @click="addRow"
    >
      Add certification
    </button>
  </div>
</template>
