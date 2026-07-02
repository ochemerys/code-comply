import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, ref } from 'vue'
import SeveritySelector from './SeveritySelector.vue'

const Host = defineComponent({
  components: { SeveritySelector },
  props: {
    initial: { type: String as () => 'MINOR' | 'MAJOR' | 'CRITICAL', default: 'MINOR' },
    disabled: Boolean,
  },
  setup(props) {
    const model = ref(props.initial)
    return { model }
  },
  template:
    '<SeveritySelector v-model="model" id="sev-host" :disabled="disabled" aria-labelledby="sev-lbl" />',
})

describe('SeveritySelector', () => {
  it('renders Minor, Major, and Critical options', () => {
    const wrapper = mount(Host, { props: { initial: 'MINOR' } })
    expect(wrapper.find('[data-testid="severity-option-MINOR"]').text()).toContain('Minor')
    expect(wrapper.find('[data-testid="severity-option-MAJOR"]').text()).toContain('Major')
    expect(wrapper.find('[data-testid="severity-option-CRITICAL"]').text()).toContain('Critical')
  })

  it('updates v-model when an option is selected', async () => {
    const wrapper = mount(Host, { props: { initial: 'MINOR' } })
    await wrapper.find('[data-testid="severity-option-MAJOR"]').trigger('click')
    const radio = wrapper.find('input[type="radio"][value="MAJOR"]').element as HTMLInputElement
    expect(radio.checked).toBe(true)
  })

  it('applies distinct color classes per severity level', () => {
    const wrapper = mount(Host, { props: { initial: 'CRITICAL' } })
    const minor = wrapper.find('[data-testid="severity-option-MINOR"] span')
    const major = wrapper.find('[data-testid="severity-option-MAJOR"] span')
    const crit = wrapper.find('[data-testid="severity-option-CRITICAL"] span')
    expect(minor.classes().some((c) => c.includes('yellow'))).toBe(true)
    expect(major.classes().some((c) => c.includes('orange'))).toBe(true)
    expect(crit.classes().some((c) => c.includes('red'))).toBe(true)
  })

  it('exposes radiogroup semantics and per-option labels', () => {
    const wrapper = mount(Host, {
      props: { initial: 'MINOR' },
      attachTo: document.body,
    })
    const group = wrapper.find('[role="radiogroup"]')
    expect(group.exists()).toBe(true)
    expect(group.attributes('aria-labelledby')).toBe('sev-lbl')
    const minorInput = wrapper.find('input[type="radio"][value="MINOR"]')
    expect(minorInput.attributes('aria-label')).toBe('Minor')
    wrapper.unmount()
  })

  it('disables inputs when disabled prop is true', () => {
    const wrapper = mount(Host, { props: { initial: 'MINOR', disabled: true } })
    const inputs = wrapper.findAll('input[type="radio"]')
    inputs.forEach((w) => {
      expect((w.element as HTMLInputElement).disabled).toBe(true)
    })
  })
})
