<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { AdminChecklistItemInput } from '@codecomply/validators'
import {
  isSessionExpiredRedirectError,
  useAdminChecklistTemplateDetail,
  useCreateChecklistTemplateMutation,
  useNewChecklistTemplateVersionMutation,
  usePublishChecklistTemplateMutation,
  useUpdateChecklistTemplateMutation,
} from '../composables/useAdminChecklistTemplates'

const route = useRoute()
const router = useRouter()

const isNew = computed(() => route.name === 'checklist-template-new')
const templateId = computed(() => (isNew.value ? '' : String(route.params.id ?? '')))

const name = ref('')
const discipline = ref('')
const items = ref<AdminChecklistItemInput[]>([
  { order: 1, text: '', isRequired: true, requiresPhoto: false },
])

const lockedMessage = ref<string | null>(null)
const saveMessage = ref<string | null>(null)

const { data, isPending, error } = useAdminChecklistTemplateDetail(templateId)
const createMutation = useCreateChecklistTemplateMutation()
const updateMutation = useUpdateChecklistTemplateMutation()
const publishMutation = usePublishChecklistTemplateMutation()
const newVersionMutation = useNewChecklistTemplateVersionMutation()

watch(
  data,
  (tpl) => {
    if (!tpl) return
    name.value = tpl.name
    discipline.value = tpl.discipline
    items.value = tpl.items.map((item) => ({
      id: item.id,
      order: item.order,
      text: item.text,
      category: item.category,
      isRequired: item.isRequired,
      requiresPhoto: item.requiresPhoto,
      codeReferences: item.codeReferences,
    }))
  },
  { immediate: true },
)

const showError = computed(
  () => !!error.value && !isNew.value && !isSessionExpiredRedirectError(error.value),
)
const isLocked = computed(() => data.value?.isLocked === true)
const versionLabel = computed(() => (data.value ? `${data.value.version}.0` : '1.0'))

function itemCodeRef(item: AdminChecklistItemInput): { code: string; section: string } {
  if (!item.codeReferences?.length) {
    item.codeReferences = [{ code: '', section: '' }]
  }
  return item.codeReferences[0]!
}

function addItem() {
  items.value.push({
    order: items.value.length + 1,
    text: '',
    isRequired: true,
    requiresPhoto: false,
  })
}

function removeItem(index: number) {
  items.value.splice(index, 1)
  items.value.forEach((item, idx) => {
    item.order = idx + 1
  })
}

function buildPayloadItems() {
  return items.value
    .filter((item) => item.text.trim().length > 0)
    .map((item, index) => {
      const ref = item.codeReferences?.[0]
      const codeReferences =
        ref && ref.code.trim() && ref.section.trim()
          ? [{ code: ref.code.trim(), section: ref.section.trim(), title: ref.title }]
          : undefined
      return {
        ...item,
        order: index + 1,
        text: item.text.trim(),
        codeReferences,
      }
    })
}

async function onSave() {
  lockedMessage.value = null
  saveMessage.value = null
  const payloadItems = buildPayloadItems()
  if (payloadItems.length === 0) {
    saveMessage.value = 'Add at least one checklist item.'
    return
  }

  try {
    if (isNew.value) {
      const created = await createMutation.mutateAsync({
        name: name.value.trim(),
        discipline: discipline.value.trim(),
        items: payloadItems,
        publish: false,
      })
      saveMessage.value = 'Template created.'
      void router.replace({ name: 'checklist-template-edit', params: { id: created.id } })
      return
    }

    await updateMutation.mutateAsync({
      id: templateId.value,
      body: {
        name: name.value.trim(),
        discipline: discipline.value.trim(),
        items: payloadItems,
        createNewVersion: false,
      },
    })
    saveMessage.value = 'Template saved.'
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Save failed'
    if (message.toLowerCase().includes('locked')) {
      lockedMessage.value = 'This template version is locked'
    }
    saveMessage.value = message
  }
}

async function onPublish() {
  if (isNew.value || !templateId.value) return
  saveMessage.value = null
  try {
    await publishMutation.mutateAsync(templateId.value)
    saveMessage.value = 'Template published and available for inspections.'
  } catch (e) {
    saveMessage.value = e instanceof Error ? e.message : 'Publish failed'
  }
}

async function onCreateNewVersion() {
  if (isNew.value || !templateId.value) return
  lockedMessage.value = null
  saveMessage.value = null
  try {
    const created = await newVersionMutation.mutateAsync({
      id: templateId.value,
      body: {
        name: name.value.trim(),
        discipline: discipline.value.trim(),
        items: buildPayloadItems(),
      },
    })
    saveMessage.value = `New version ${created.version}.0 created.`
    void router.replace({ name: 'checklist-template-edit', params: { id: created.id } })
  } catch (e) {
    saveMessage.value = e instanceof Error ? e.message : 'Failed to create new version'
  }
}

function goBack() {
  void router.push({ name: 'checklist-templates' })
}
</script>

<template>
  <div class="space-y-4 min-w-0 max-w-full" data-testid="checklist-template-editor">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <button
          type="button"
          class="text-sm text-primary-600 hover:text-primary-800 mb-2"
          @click="goBack"
        >
          ← Back to templates
        </button>
        <p v-if="!isNew" class="text-text-secondary">
          Version {{ versionLabel }}
          <span v-if="data?.versionHash" class="font-mono text-xs ml-2">{{
            data.versionHash
          }}</span>
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <button
          v-if="!isNew && isLocked"
          type="button"
          class="inline-flex items-center justify-center px-4 py-2.5 rounded-lg border border-amber-300 bg-amber-50 text-amber-900 text-sm font-medium hover:bg-amber-100 min-h-[44px]"
          data-testid="checklist-template-new-version-button"
          :disabled="newVersionMutation.isPending.value"
          @click="onCreateNewVersion"
        >
          Create New Version
        </button>
        <button
          v-if="!isNew && !data?.isActive"
          type="button"
          class="inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 min-h-[44px]"
          data-testid="checklist-template-publish-button"
          :disabled="publishMutation.isPending.value || isLocked"
          @click="onPublish"
        >
          Publish
        </button>
        <button
          type="button"
          class="inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-50 min-h-[44px]"
          data-testid="checklist-template-save-button"
          :disabled="createMutation.isPending.value || updateMutation.isPending.value || isLocked"
          @click="onSave"
        >
          Save Template
        </button>
      </div>
    </div>

    <div
      v-if="lockedMessage"
      class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
      data-testid="checklist-template-locked-message"
    >
      {{ lockedMessage }} — use Create New Version to edit.
    </div>

    <div
      v-if="saveMessage"
      class="rounded-lg border border-border-subtle bg-bg-app px-4 py-3 text-sm text-text-primary"
      data-testid="checklist-template-save-message"
    >
      {{ saveMessage }}
    </div>

    <div
      v-if="showError"
      class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
    >
      {{ error instanceof Error ? error.message : 'Failed to load template' }}
    </div>

    <div v-if="!isNew && isPending" class="text-sm text-text-secondary">Loading template…</div>

    <div v-else class="grid gap-4 lg:grid-cols-2">
      <div class="space-y-3">
        <div>
          <label for="tpl-name" class="block text-sm font-medium text-text-secondary mb-1"
            >Name</label
          >
          <input
            id="tpl-name"
            v-model="name"
            type="text"
            class="w-full rounded-lg border border-border-strong px-3 py-2 text-sm"
            data-testid="checklist-template-name"
            :disabled="isLocked"
          />
        </div>
        <div>
          <label for="tpl-discipline" class="block text-sm font-medium text-text-secondary mb-1">
            Discipline
          </label>
          <input
            id="tpl-discipline"
            v-model="discipline"
            type="text"
            class="w-full rounded-lg border border-border-strong px-3 py-2 text-sm"
            data-testid="checklist-template-discipline"
            :disabled="isLocked"
          />
        </div>
      </div>

      <div class="rounded-lg border border-border-subtle bg-bg-surface p-4 space-y-3">
        <div class="flex items-center justify-between">
          <h3 class="font-semibold text-text-primary">Checklist items</h3>
          <button
            type="button"
            class="text-sm text-primary-600 hover:text-primary-800"
            data-testid="checklist-template-add-item"
            :disabled="isLocked"
            @click="addItem"
          >
            Add item
          </button>
        </div>

        <div
          v-for="(item, index) in items"
          :key="index"
          class="border border-border-subtle rounded-lg p-3 space-y-2"
          :data-testid="`checklist-template-item-${index}`"
        >
          <input
            v-model="item.text"
            type="text"
            placeholder="Item description"
            class="w-full rounded-lg border border-border-strong px-3 py-2 text-sm"
            :disabled="isLocked"
          />
          <div class="flex flex-wrap gap-4 text-sm text-text-secondary">
            <label class="inline-flex items-center gap-2">
              <input v-model="item.isRequired" type="checkbox" :disabled="isLocked" />
              Required
            </label>
            <label class="inline-flex items-center gap-2">
              <input v-model="item.requiresPhoto" type="checkbox" :disabled="isLocked" />
              Photo required
            </label>
            <button
              type="button"
              class="text-red-600 hover:text-red-800 ml-auto"
              :disabled="isLocked || items.length <= 1"
              @click="removeItem(index)"
            >
              Remove
            </button>
          </div>
          <input
            v-model="itemCodeRef(item).code"
            type="text"
            placeholder="Code reference (e.g. NBC 2019)"
            class="w-full rounded-lg border border-border-strong px-3 py-2 text-sm"
            :disabled="isLocked"
          />
          <input
            v-model="itemCodeRef(item).section"
            type="text"
            placeholder="Section (e.g. 9.10.14.1)"
            class="w-full rounded-lg border border-border-strong px-3 py-2 text-sm"
            :disabled="isLocked"
          />
        </div>
      </div>
    </div>
  </div>
</template>
