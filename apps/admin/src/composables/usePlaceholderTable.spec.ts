import { describe, it, expect } from 'vitest'
import { usePlaceholderTable } from './usePlaceholderTable'

describe('usePlaceholderTable', () => {
  it('exposes a table with core row model for empty data', () => {
    const { table, data } = usePlaceholderTable()
    expect(data.value).toEqual([])
    expect(table.getRowModel().rows.length).toBe(0)
  })

  it('reflects row data in the table model', () => {
    const { table, data } = usePlaceholderTable([{ id: '1', label: 'One' }])
    expect(table.getRowModel().rows.length).toBe(1)
    data.value = [
      { id: '1', label: 'One' },
      { id: '2', label: 'Two' },
    ]
    expect(table.getRowModel().rows.length).toBe(2)
  })
})
