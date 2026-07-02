<script setup lang="ts">
import { computed, ref } from 'vue'
import { isAllowedUploadMime, useUploadDocumentMutation } from '../composables/useAdminDocuments'

const props = defineProps<{
  inspectionId: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  (e: 'uploaded'): void
}>()

const inspectionIdRef = computed(() => props.inspectionId)
const uploadMutation = useUploadDocumentMutation(inspectionIdRef)
const dragOver = ref(false)
const formError = ref<string | null>(null)
const description = ref('')

async function uploadFile(file: File) {
  formError.value = null
  if (!isAllowedUploadMime(file.type)) {
    formError.value = 'Only PDF and image files (JPEG, PNG, WebP) are allowed'
    return
  }
  try {
    await uploadMutation.mutateAsync({
      file,
      description: description.value.trim() || undefined,
    })
    description.value = ''
    emit('uploaded')
  } catch (e) {
    formError.value = e instanceof Error ? e.message : 'Upload failed'
  }
}

function onFileInput(ev: Event) {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) void uploadFile(file)
  input.value = ''
}

function onDrop(ev: DragEvent) {
  ev.preventDefault()
  dragOver.value = false
  if (props.disabled) return
  const file = ev.dataTransfer?.files?.[0]
  if (file) void uploadFile(file)
}
</script>

<template>
  <section
    class="rounded-lg border border-border-subtle bg-bg-surface p-5 shadow-sm"
    data-testid="document-upload-panel"
  >
    <h3 class="text-lg font-semibold text-text-primary">Upload supporting document</h3>
    <p class="mt-1 text-sm text-text-secondary">PDF or image files up to 10 MB.</p>

    <label class="mt-3 block text-sm text-text-secondary">
      <span class="font-medium">Description (optional)</span>
      <input
        v-model="description"
        type="text"
        class="mt-1 w-full rounded-md border border-border-strong px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        data-testid="document-upload-description"
        :disabled="disabled"
      />
    </label>

    <div
      class="mt-4 flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors"
      :class="
        dragOver
          ? 'border-primary-400 bg-primary-50'
          : 'border-border-strong bg-bg-app hover:border-border-strong'
      "
      data-testid="document-upload-dropzone"
      @dragover.prevent="dragOver = true"
      @dragleave.prevent="dragOver = false"
      @drop="onDrop"
    >
      <p class="text-sm text-text-secondary">Drag and drop a file here, or</p>
      <label
        class="mt-2 inline-flex cursor-pointer items-center rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
        data-testid="document-upload-choose"
      >
        <input
          type="file"
          class="sr-only"
          accept=".pdf,image/jpeg,image/png,image/webp"
          :disabled="disabled || uploadMutation.isPending.value"
          @change="onFileInput"
        />
        {{ uploadMutation.isPending.value ? 'Uploading…' : 'Choose file' }}
      </label>
    </div>

    <p
      v-if="formError"
      class="mt-3 text-sm text-red-700"
      role="alert"
      data-testid="document-upload-error"
    >
      {{ formError }}
    </p>
  </section>
</template>
