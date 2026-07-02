<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useAdminSsoSettings } from '../composables/useAdminSsoSettings'

const { ssoQuery, sessionPolicyQuery, saveSso } = useAdminSsoSettings()

const enabled = ref(false)
const issuerUrl = ref('')
const clientId = ref('')
const redirectUrisText = ref('')
const saveMessage = ref('')

watch(
  () => ssoQuery.data.value,
  (s) => {
    if (!s) return
    enabled.value = s.enabled
    issuerUrl.value = s.issuerUrl
    clientId.value = s.clientId
    redirectUrisText.value = s.redirectUris.join('\n')
  },
  { immediate: true },
)

const loading = computed(() => ssoQuery.isPending.value || sessionPolicyQuery.isPending.value)
const ssoError = computed(() => {
  const e = ssoQuery.error.value
  return e instanceof Error ? e.message : ''
})
const saving = computed(() => saveSso.isPending.value)

const sessionPolicy = computed(() => sessionPolicyQuery.data.value)
const docUrl = computed(() => ssoQuery.data.value?.documentationUrl)
const clientSecretConfigured = computed(() => ssoQuery.data.value?.clientSecretConfigured ?? false)

async function saveSettings() {
  saveMessage.value = ''
  const redirectUris = redirectUrisText.value
    .split(/[\n,]+/)
    .map((line) => line.trim())
    .filter(Boolean)

  try {
    await saveSso.mutateAsync({
      enabled: enabled.value,
      issuerUrl: issuerUrl.value.trim(),
      clientId: clientId.value.trim(),
      redirectUris,
    })
    saveMessage.value = 'SSO settings saved.'
  } catch (e) {
    saveMessage.value = e instanceof Error ? e.message : 'Failed to save settings'
  }
}
</script>

<template>
  <div data-testid="settings-view" class="space-y-8">
    <p class="text-text-secondary">Organization SSO and admin session policy</p>

    <div
      v-if="loading"
      class="rounded-lg border border-border-subtle bg-bg-app px-4 py-6 text-text-secondary"
      data-testid="settings-loading"
    >
      Loading settings…
    </div>

    <template v-else>
      <section
        class="rounded-lg border border-border-subtle bg-bg-surface p-6 shadow-sm"
        data-testid="settings-sso-section"
      >
        <div class="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 class="text-lg font-semibold text-text-primary">SSO / OIDC</h3>
            <p class="text-sm text-text-secondary">
              Client secret is configured on the server via
              <code class="rounded bg-bg-app px-1">SSO_CLIENT_SECRET</code> and is never shown in
              the browser.
            </p>
            <a
              v-if="docUrl"
              :href="docUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="mt-1 inline-block text-sm font-medium text-primary-600 hover:text-primary-800"
              data-testid="settings-sso-docs"
            >
              Open IdP integration documentation
            </a>
          </div>
          <span
            class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
            :class="
              clientSecretConfigured ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-900'
            "
            data-testid="settings-sso-secret-status"
          >
            {{
              clientSecretConfigured
                ? 'Client secret configured'
                : 'Client secret not set on server'
            }}
          </span>
        </div>

        <div
          v-if="ssoError"
          class="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {{ ssoError }}
        </div>

        <form class="space-y-4" @submit.prevent="saveSettings">
          <label class="flex items-center gap-2 text-sm font-medium text-text-secondary">
            <input v-model="enabled" type="checkbox" data-testid="settings-sso-enabled" />
            Enable SSO for inspector sign-in
          </label>

          <label class="block text-sm">
            <span class="font-medium text-text-secondary">Issuer URL</span>
            <input
              v-model="issuerUrl"
              type="url"
              class="mt-1 w-full max-w-2xl rounded-md border border-border-strong px-3 py-2 text-sm shadow-sm"
              placeholder="https://login.example.com/tenant/v2.0"
              data-testid="settings-sso-issuer"
            />
          </label>

          <label class="block text-sm">
            <span class="font-medium text-text-secondary">Client ID</span>
            <input
              v-model="clientId"
              type="text"
              class="mt-1 w-full max-w-xl rounded-md border border-border-strong px-3 py-2 text-sm shadow-sm"
              data-testid="settings-sso-client-id"
            />
          </label>

          <label class="block text-sm">
            <span class="font-medium text-text-secondary">Redirect URIs (one per line)</span>
            <textarea
              v-model="redirectUrisText"
              rows="3"
              class="mt-1 w-full max-w-2xl rounded-md border border-border-strong px-3 py-2 font-mono text-sm shadow-sm"
              data-testid="settings-sso-redirect-uris"
            />
          </label>

          <div class="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              class="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
              data-testid="settings-sso-save"
              :disabled="saving"
            >
              Save SSO settings
            </button>
            <p
              v-if="saveMessage"
              class="text-sm"
              :class="saveMessage.includes('saved') ? 'text-green-700' : 'text-red-700'"
              data-testid="settings-sso-save-message"
            >
              {{ saveMessage }}
            </p>
          </div>
        </form>
      </section>

      <section
        class="rounded-lg border border-border-subtle bg-bg-surface p-6 shadow-sm"
        data-testid="settings-session-section"
      >
        <h3 class="mb-2 text-lg font-semibold text-text-primary">Session / idle policy</h3>
        <p class="mb-4 text-sm text-text-secondary">
          Read-only summary of idle timeout thresholds (NFR-A-01). Values may come from server
          environment variables or the admin app build.
        </p>
        <dl v-if="sessionPolicy" class="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt class="font-medium text-text-dim">Warn after</dt>
            <dd data-testid="settings-session-warn">
              {{ sessionPolicy.idleWarnAfterMinutes }} minutes
            </dd>
          </div>
          <div>
            <dt class="font-medium text-text-dim">Logout after</dt>
            <dd data-testid="settings-session-logout">
              {{ sessionPolicy.idleLogoutAfterMinutes }} minutes
            </dd>
          </div>
          <div>
            <dt class="font-medium text-text-dim">Source</dt>
            <dd class="capitalize" data-testid="settings-session-source">
              {{ sessionPolicy.source }}
            </dd>
          </div>
        </dl>
      </section>
    </template>
  </div>
</template>
