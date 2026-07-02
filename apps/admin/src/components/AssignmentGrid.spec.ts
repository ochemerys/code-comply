import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AssignmentGrid from './AssignmentGrid.vue'

const weekStart = '2026-05-18'

const inspectors = [
  { id: 'insp-alex', name: 'Alex Inspector', disciplines: ['Building'] },
  { id: 'insp-jordan', name: 'Jordan Field', disciplines: ['Plumbing', 'Gas'] },
]

const unassigned = [
  {
    id: 'asg-901',
    inspectionId: 'asg-901',
    permitId: 'P-24017',
    label: 'Reinspection',
    discipline: 'Electrical',
  },
]

const assignments = [
  {
    id: 'asg-703',
    inspectionId: 'asg-703',
    permitId: 'P-24003',
    label: 'Review',
    inspectorId: 'insp-alex',
    isoDate: '2026-05-20',
  },
]

function mountGrid(overrides: Partial<InstanceType<typeof AssignmentGrid>['$props']> = {}) {
  return mount(AssignmentGrid, {
    props: {
      weekStartIso: weekStart,
      inspectors,
      unassigned,
      assignments,
      ...overrides,
    },
  })
}

function makeDataTransfer() {
  const store = new Map<string, string>()
  return {
    effectAllowed: 'move',
    dropEffect: 'move',
    setData: (type: string, value: string) => store.set(type, value),
    getData: (type: string) => store.get(type) ?? '',
  }
}

describe('AssignmentGrid', () => {
  it('renders the grid', () => {
    const wrapper = mountGrid()
    expect(wrapper.find('[data-testid="assignment-grid"]').exists()).toBe(true)
  })

  it('displays assignments from props', () => {
    const wrapper = mountGrid()
    expect(wrapper.get('[data-testid="assignment-chip-asg-703"]').text()).toContain('P-24003')
  })

  it('renders a mobile day/list fallback alongside the desktop matrix', () => {
    const wrapper = mountGrid()
    const mobile = wrapper.get('[data-testid="assignment-grid-mobile"]')
    expect(mobile.classes()).toContain('md:hidden')

    const day = wrapper.get('[data-testid="assignment-grid-mobile-day-2026-05-20"]')
    const item = day.get('[data-testid="assignment-grid-mobile-item-asg-703"]')
    expect(item.text()).toContain('P-24003')
    expect(item.text()).toContain('Alex Inspector')
  })

  it('allows click-to-assign from the unassigned pool', async () => {
    const wrapper = mountGrid()
    const cellButtons = wrapper.findAll('[data-testid^="assignment-cell-"]')
    expect(cellButtons.length).toBeGreaterThan(0)

    await cellButtons[0]!.trigger('click')
    expect(wrapper.find('[data-testid="assignment-grid-assign-panel"]').exists()).toBe(true)

    await wrapper.get('[data-testid="assignment-grid-unassigned-asg-901"]').trigger('click')
    expect(wrapper.emitted('assign')?.[0]?.[0]).toEqual({
      inspectionId: 'asg-901',
      inspectorId: expect.any(String),
      isoDate: expect.any(String),
    })
  })

  it('supports drag-and-drop reassignment between cells', async () => {
    const wrapper = mountGrid()
    const dataTransfer = makeDataTransfer()

    const chip = wrapper.get('[data-testid="assignment-chip-asg-703"]')
    await chip.trigger('dragstart', { dataTransfer })

    const targets = wrapper.findAll('[data-testid^="assignment-cell-"]')
    const target = targets.find((t) => t.attributes('data-testid')?.includes('insp-jordan'))
    expect(target).toBeTruthy()

    await target!.trigger('drop', { dataTransfer })
    expect(wrapper.emitted('reassign')?.[0]?.[0]).toMatchObject({
      inspectionId: 'asg-703',
      inspectorId: 'insp-jordan',
    })
  })

  it('shows discipline mismatch when assigning Electrical permit to Plumbing-only SCO', async () => {
    const wrapper = mountGrid()
    const jordanCell = wrapper.findAll('[data-testid^="assignment-cell-insp-jordan-"]')[0]
    expect(jordanCell).toBeTruthy()

    await jordanCell!.trigger('click')
    expect(
      wrapper.find('[data-testid="assignment-grid-discipline-mismatch-asg-901"]').exists(),
    ).toBe(true)
  })

  it('shows availability suggestion when selected cell is near daily maximum', async () => {
    const nearMaxAssignments = [
      ...assignments,
      {
        id: 'asg-704',
        inspectionId: 'asg-704',
        permitId: 'P-24004',
        label: 'A',
        inspectorId: 'insp-alex',
        isoDate: '2026-05-20',
      },
      {
        id: 'asg-705',
        inspectionId: 'asg-705',
        permitId: 'P-24005',
        label: 'B',
        inspectorId: 'insp-alex',
        isoDate: '2026-05-20',
      },
      {
        id: 'asg-706',
        inspectionId: 'asg-706',
        permitId: 'P-24006',
        label: 'C',
        inspectorId: 'insp-alex',
        isoDate: '2026-05-20',
      },
    ]

    const wrapper = mountGrid({ assignments: nearMaxAssignments, maxAssignmentsPerDay: 5 })
    const alexCell = wrapper.find('[data-testid="assignment-cell-insp-alex-2026-05-20"]')
    await alexCell.trigger('click')

    expect(wrapper.find('[data-testid="assignment-grid-availability-warning"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="assignment-grid-availability-warning"]').text()).toMatch(
      /one slot remaining/i,
    )
  })

  it('shows over-capacity note when selected cell is at daily maximum', async () => {
    const atMaxAssignments = [
      ...assignments,
      {
        id: 'asg-704',
        inspectionId: 'asg-704',
        permitId: 'P-24004',
        label: 'A',
        inspectorId: 'insp-alex',
        isoDate: '2026-05-20',
      },
      {
        id: 'asg-705',
        inspectionId: 'asg-705',
        permitId: 'P-24005',
        label: 'B',
        inspectorId: 'insp-alex',
        isoDate: '2026-05-20',
      },
      {
        id: 'asg-706',
        inspectionId: 'asg-706',
        permitId: 'P-24006',
        label: 'C',
        inspectorId: 'insp-alex',
        isoDate: '2026-05-20',
      },
      {
        id: 'asg-707',
        inspectionId: 'asg-707',
        permitId: 'P-24007',
        label: 'D',
        inspectorId: 'insp-alex',
        isoDate: '2026-05-20',
      },
      {
        id: 'asg-708',
        inspectionId: 'asg-708',
        permitId: 'P-24008',
        label: 'E',
        inspectorId: 'insp-alex',
        isoDate: '2026-05-20',
      },
    ]

    const wrapper = mountGrid({ assignments: atMaxAssignments, maxAssignmentsPerDay: 5 })
    const alexCell = wrapper.find('[data-testid="assignment-cell-insp-alex-2026-05-20"]')
    await alexCell.trigger('click')

    expect(wrapper.find('[data-testid="assignment-grid-over-capacity-note"]').exists()).toBe(true)
  })
})
