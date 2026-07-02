import { describe, it, expect, beforeEach } from 'vitest'
import {
  ADMIN_REPORTS_SELECTION_STORAGE_KEY,
  clearAdminReportsSelection,
  loadAdminReportsSelection,
  saveAdminReportsSelection,
} from './adminReportsSelectionStorage'

describe('adminReportsSelectionStorage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('saves and loads selection for the same user', () => {
    saveAdminReportsSelection({
      userId: 'admin-1',
      inspectionId: 'insp-1',
      inspectionStatusFilter: 'IN_PROGRESS',
    })

    expect(loadAdminReportsSelection('admin-1')).toEqual({
      userId: 'admin-1',
      inspectionId: 'insp-1',
      inspectionStatusFilter: 'IN_PROGRESS',
    })
  })

  it('returns null when stored selection belongs to another user', () => {
    saveAdminReportsSelection({
      userId: 'admin-1',
      inspectionId: 'insp-1',
      inspectionStatusFilter: 'IN_PROGRESS',
    })

    expect(loadAdminReportsSelection('admin-2')).toBeNull()
  })

  it('returns null for invalid persisted payloads', () => {
    localStorage.setItem(
      ADMIN_REPORTS_SELECTION_STORAGE_KEY,
      JSON.stringify({ userId: 'admin-1', inspectionId: '', inspectionStatusFilter: 'NOPE' }),
    )

    expect(loadAdminReportsSelection('admin-1')).toBeNull()
  })

  it('clears persisted selection', () => {
    saveAdminReportsSelection({
      userId: 'admin-1',
      inspectionId: 'insp-1',
      inspectionStatusFilter: 'PASSED',
    })

    clearAdminReportsSelection()

    expect(localStorage.getItem(ADMIN_REPORTS_SELECTION_STORAGE_KEY)).toBeNull()
    expect(loadAdminReportsSelection('admin-1')).toBeNull()
  })
})
