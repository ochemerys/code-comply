import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, ref } from 'vue'
import OutcomeSelector from './OutcomeSelector.vue'

const Host = defineComponent({
  components: { OutcomeSelector },
  props: {
    initial: {
      type: String as () => 'ACCEPTABLE' | 'ACCEPTABLE_WITH_CONDITIONS' | 'REFUSED' | undefined,
      default: undefined,
    },
    disabled: Boolean,
  },
  setup(props) {
    const model = ref(props.initial)
    return { model }
  },
  template:
    '<OutcomeSelector v-model="model" id="outcome-host" :disabled="disabled" aria-labelledby="outcome-lbl" />',
})

describe('OutcomeSelector', () => {
  it('renders Acceptable, Acceptable with Conditions, and Refused options', () => {
    const wrapper = mount(Host, { props: { initial: 'ACCEPTABLE' } })
    expect(wrapper.find('[data-testid="outcome-option-ACCEPTABLE"]').text()).toContain('Acceptable')
    expect(wrapper.find('[data-testid="outcome-option-ACCEPTABLE"]').text()).toContain(
      'Inspection passed with no issues',
    )
    expect(
      wrapper.find('[data-testid="outcome-option-ACCEPTABLE_WITH_CONDITIONS"]').text(),
    ).toContain('Acceptable with Conditions')
    expect(
      wrapper.find('[data-testid="outcome-option-ACCEPTABLE_WITH_CONDITIONS"]').text(),
    ).toContain('minor deficiencies')
    expect(wrapper.find('[data-testid="outcome-option-REFUSED"]').text()).toContain('Refused')
    expect(wrapper.find('[data-testid="outcome-option-REFUSED"]').text()).toContain('major issues')
  })

  it('updates v-model when an option is selected', async () => {
    const wrapper = mount(Host, { props: { initial: 'ACCEPTABLE' } })
    await wrapper.find('[data-testid="outcome-option-REFUSED"]').trigger('click')
    const radio = wrapper.find('input[type="radio"][value="REFUSED"]').element as HTMLInputElement
    expect(radio.checked).toBe(true)
  })

  it('applies distinct color classes per outcome', () => {
    const wrapper = mount(Host, { props: { initial: 'REFUSED' } })
    const ok = wrapper.find('[data-testid="outcome-option-ACCEPTABLE"] span')
    const cond = wrapper.find('[data-testid="outcome-option-ACCEPTABLE_WITH_CONDITIONS"] span')
    const refused = wrapper.find('[data-testid="outcome-option-REFUSED"] span')
    expect(ok.classes().some((c) => c.includes('emerald'))).toBe(true)
    expect(cond.classes().some((c) => c.includes('yellow'))).toBe(true)
    expect(refused.classes().some((c) => c.includes('red'))).toBe(true)
  })

  it('exposes radiogroup semantics and per-option labels', () => {
    const wrapper = mount(Host, {
      props: { initial: 'ACCEPTABLE' },
      attachTo: document.body,
    })
    const group = wrapper.find('[role="radiogroup"]')
    expect(group.exists()).toBe(true)
    expect(group.attributes('aria-labelledby')).toBe('outcome-lbl')
    const okInput = wrapper.find('input[type="radio"][value="ACCEPTABLE"]')
    expect(okInput.attributes('aria-label')).toBe('Acceptable')
    wrapper.unmount()
  })

  it('disables inputs when disabled prop is true', () => {
    const wrapper = mount(Host, { props: { initial: 'ACCEPTABLE', disabled: true } })
    const inputs = wrapper.findAll('input[type="radio"]')
    inputs.forEach((w) => {
      expect((w.element as HTMLInputElement).disabled).toBe(true)
    })
  })
})
