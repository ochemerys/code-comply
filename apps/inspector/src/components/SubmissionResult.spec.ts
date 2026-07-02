import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SubmissionResult from './SubmissionResult.vue'

describe('SubmissionResult', () => {
  it('renders success state with inspection id and actions', () => {
    const wrapper = mount(SubmissionResult, {
      props: {
        state: 'success',
        inspectionId: 'insp-123',
      },
    })

    expect(wrapper.get('[data-testid="submission-result-title"]').text()).toContain(
      'Inspection submitted successfully',
    )
    expect(wrapper.get('[data-testid="submission-result-inspection-id"]').text()).toContain(
      'insp-123',
    )
    expect(wrapper.get('[data-testid="submission-result-view-details"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="submission-result-start-new"]').exists()).toBe(true)
  })

  it('emits success actions', async () => {
    const wrapper = mount(SubmissionResult, {
      props: {
        state: 'success',
        inspectionId: 'insp-123',
      },
    })

    await wrapper.get('[data-testid="submission-result-view-details"]').trigger('click')
    await wrapper.get('[data-testid="submission-result-start-new"]').trigger('click')

    expect(wrapper.emitted('view-details')).toBeTruthy()
    expect(wrapper.emitted('start-new')).toBeTruthy()
  })

  it('renders failure state with error and retry/save actions', () => {
    const wrapper = mount(SubmissionResult, {
      props: {
        state: 'failure',
        errorMessage: 'Network down',
      },
    })

    expect(wrapper.get('[data-testid="submission-result-title"]').text()).toContain(
      'Submission failed',
    )
    expect(wrapper.get('[data-testid="submission-result-message"]').text()).toContain(
      'Network down',
    )
    expect(wrapper.get('[data-testid="submission-result-retry"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="submission-result-save-for-later"]').exists()).toBe(true)
  })

  it('emits failure actions', async () => {
    const wrapper = mount(SubmissionResult, {
      props: {
        state: 'failure',
        errorMessage: 'Oops',
      },
    })

    await wrapper.get('[data-testid="submission-result-retry"]').trigger('click')
    await wrapper.get('[data-testid="submission-result-save-for-later"]').trigger('click')

    expect(wrapper.emitted('retry')).toBeTruthy()
    expect(wrapper.emitted('save-for-later')).toBeTruthy()
  })
})
