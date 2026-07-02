import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import type { UserDTO } from '@codecomply/validators'
import UserTable from './UserTable.vue'

const iso = () => new Date().toISOString()

function makeUser(partial: Partial<UserDTO> & Pick<UserDTO, 'id' | 'name' | 'email'>): UserDTO {
  return {
    role: 'SCO',
    disciplines: ['Building'],
    createdAt: iso(),
    updatedAt: iso(),
    ...partial,
  }
}

describe('UserTable', () => {
  it('shows loading state', () => {
    const wrapper = mount(UserTable, {
      props: { users: [], loading: true },
    })
    expect(wrapper.get('[data-testid="user-table-loading"]').text()).toContain('Loading')
  })

  it('renders rows and supports pagination', async () => {
    const users: UserDTO[] = Array.from({ length: 10 }, (_, i) =>
      makeUser({
        id: `u-${i}`,
        name: `User ${i}`,
        email: `u${i}@test.com`,
        isActive: i % 2 === 0,
      }),
    )
    const wrapper = mount(UserTable, {
      props: { users, loading: false },
    })
    expect(wrapper.text()).toContain('User 0')
    expect(wrapper.text()).not.toContain('User 8')
    await wrapper.get('[data-testid="user-table-next"]').trigger('click')
    expect(wrapper.text()).toContain('User 8')
    await wrapper.get('[data-testid="user-table-prev"]').trigger('click')
    expect(wrapper.text()).toContain('User 0')
  })

  it('emits view when action clicked', async () => {
    const users = [makeUser({ id: 'a1', name: 'Ann', email: 'ann@test.com', isActive: true })]
    const wrapper = mount(UserTable, {
      props: { users, loading: false },
    })
    await wrapper.get('[data-testid="user-table-view-a1"]').trigger('click')
    expect(wrapper.emitted('view')?.[0]).toEqual(['a1'])
  })

  it('filters rows with global filter', async () => {
    const users = [
      makeUser({ id: '1', name: 'Alice', email: 'alice@test.com', isActive: true }),
      makeUser({ id: '2', name: 'Bob', email: 'bob@other.com', isActive: true }),
    ]
    const wrapper = mount(UserTable, {
      props: { users, loading: false },
    })
    const input = wrapper.get('[data-testid="user-table-global-filter"]')
    await input.setValue('other')
    expect(wrapper.text()).toContain('Bob')
    expect(wrapper.text()).not.toContain('Alice')
  })

  it('renders both desktop table and mobile card layouts', () => {
    const users = [makeUser({ id: 'a1', name: 'Ann', email: 'ann@test.com', isActive: true })]
    const wrapper = mount(UserTable, {
      props: { users, loading: false },
    })
    const desktop = wrapper.get('[data-testid="user-table-desktop"]')
    expect(desktop.classes()).toContain('md:block')
    expect(desktop.classes()).toContain('hidden')

    const mobile = wrapper.get('[data-testid="user-table-mobile"]')
    expect(mobile.classes()).toContain('md:hidden')

    const card = wrapper.get('[data-testid="user-table-card-a1"]')
    expect(card.text()).toContain('Ann')
    expect(card.text()).toContain('ann@test.com')
    expect(card.text()).toContain('Active')
    expect(wrapper.find('[data-testid="user-table-card-view-a1"]').exists()).toBe(true)
  })

  it('emits view from the mobile card action', async () => {
    const users = [makeUser({ id: 'a1', name: 'Ann', email: 'ann@test.com', isActive: true })]
    const wrapper = mount(UserTable, {
      props: { users, loading: false },
    })
    await wrapper.get('[data-testid="user-table-card-view-a1"]').trigger('click')
    expect(wrapper.emitted('view')?.[0]).toEqual(['a1'])
  })
})
