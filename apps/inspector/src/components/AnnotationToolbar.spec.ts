import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AnnotationToolbar from './AnnotationToolbar.vue'

describe('AnnotationToolbar (M7-S12)', () => {
  it('renders the toolbar', () => {
    const w = mount(AnnotationToolbar, {
      props: { activeTool: null, canUndo: false },
    })
    expect(w.find('[data-testid="annotation-toolbar"]').exists()).toBe(true)
  })

  it('emits select-tool when arrow is pressed', async () => {
    const w = mount(AnnotationToolbar, {
      props: { activeTool: null, canUndo: false },
    })
    await w.find('[data-testid="annotation-tool-arrow"]').trigger('click')
    expect(w.emitted('select-tool')?.[0]).toEqual(['arrow'])
  })

  it('emits undo when undo is enabled', async () => {
    const w = mount(AnnotationToolbar, {
      props: { activeTool: 'circle', canUndo: true },
    })
    await w.find('[data-testid="annotation-undo"]').trigger('click')
    expect(w.emitted('undo')).toBeTruthy()
  })

  it('disables undo when canUndo is false', () => {
    const w = mount(AnnotationToolbar, {
      props: { activeTool: null, canUndo: false },
    })
    expect(w.find('[data-testid="annotation-undo"]').attributes('disabled')).toBeDefined()
  })

  it('emits save', async () => {
    const w = mount(AnnotationToolbar, {
      props: { activeTool: 'arrow', canUndo: false },
    })
    await w.find('[data-testid="annotation-save"]').trigger('click')
    expect(w.emitted('save')).toBeTruthy()
  })
})
