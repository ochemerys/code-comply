import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import CodeReferenceItem from './CodeReferenceItem.vue'

describe('CodeReferenceItem', () => {
  it('renders code, section, and description', () => {
    const wrapper = mount(CodeReferenceItem, {
      props: {
        item: {
          code: 'NBC',
          section: '9.10.1',
          description: 'Fire separation between units',
        },
      },
    })
    expect(wrapper.find('[data-testid="code-reference-item-code"]').text()).toBe('NBC')
    expect(wrapper.find('[data-testid="code-reference-item-section"]').text()).toBe('9.10.1')
    expect(wrapper.find('[data-testid="code-reference-item-description"]').text()).toContain(
      'Fire separation',
    )
  })

  it('emits select on click', async () => {
    const wrapper = mount(CodeReferenceItem, {
      props: {
        item: { code: 'ABC', section: '1.2.3' },
      },
    })
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('select')).toHaveLength(1)
  })
})
