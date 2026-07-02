/**
 * Integration — UploadProgress with parent state (M7-S15).
 */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import UploadProgress from '@/components/UploadProgress.vue'
import type { UploadProgressItem } from '@/components/UploadProgress.vue'

describe('UploadProgress integration', () => {
  it('parent updates queue after retry and cancel handlers', async () => {
    const queue = ref<UploadProgressItem[]>([
      { id: 'p', status: 'pending', label: 'pending.jpg' },
      { id: 'f', status: 'failed', label: 'failed.jpg' },
    ])

    const Shell = defineComponent({
      setup() {
        function onRetry(id: string) {
          queue.value = queue.value.map((i) =>
            i.id === id ? { ...i, status: 'pending' as const, progress: undefined } : i,
          )
        }
        function onCancel(id: string) {
          queue.value = queue.value.filter((i) => i.id !== id)
        }
        return () =>
          h(UploadProgress, {
            items: queue.value,
            onRetry,
            onCancel,
          })
      },
    })

    const w = mount(Shell)
    expect(w.find('[data-testid="upload-pending-row-p"]').exists()).toBe(true)
    await w.find('[data-testid="upload-cancel-p"]').trigger('click')
    expect(w.find('[data-testid="upload-pending-row-p"]').exists()).toBe(false)
    expect(queue.value.some((i) => i.id === 'p')).toBe(false)

    await w.find('[data-testid="upload-retry-f"]').trigger('click')
    expect(queue.value.find((i) => i.id === 'f')?.status).toBe('pending')
    expect(w.find('[data-testid="upload-pending-row-f"]').exists()).toBe(true)
  })
})
