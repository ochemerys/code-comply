import { ref } from 'vue'
import { useVueTable, getCoreRowModel, type ColumnDef } from '@tanstack/vue-table'

export type PlaceholderRow = { id: string; label: string }

/**
 * Minimal TanStack Table wiring for the admin app shell (M9-S1).
 * Feature views will replace this with real column definitions and data sources.
 */
export function usePlaceholderTable(initial: PlaceholderRow[] = []) {
  const data = ref<PlaceholderRow[]>(initial)
  const columns = ref<ColumnDef<PlaceholderRow>[]>([
    { accessorKey: 'id', header: 'ID' },
    { accessorKey: 'label', header: 'Label' },
  ])

  const table = useVueTable({
    get data() {
      return data.value
    },
    get columns() {
      return columns.value
    },
    getCoreRowModel: getCoreRowModel(),
  })

  return { table, data, columns }
}
