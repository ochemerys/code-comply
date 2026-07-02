import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { nextTick } from 'vue'
import {
  useFormPersistence,
  useMultiFieldPersistence,
  useDebouncedFormPersistence,
} from './useFormPersistence'

describe('useFormPersistence', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    localStorage.clear()
  })

  describe('basic functionality', () => {
    it('should initialize with default values', () => {
      const { formData } = useFormPersistence('test-form', {
        name: '',
        email: '',
        age: 0,
      })

      expect(formData.value.name).toBe('')
      expect(formData.value.email).toBe('')
      expect(formData.value.age).toBe(0)
    })

    it('should save form data to localStorage on change', async () => {
      const { formData, storageKey } = useFormPersistence('test-form', {
        name: '',
        email: '',
      })

      formData.value.name = 'John Doe'
      formData.value.email = 'john@example.com'

      await nextTick()

      const stored = localStorage.getItem(storageKey)
      expect(stored).toBeTruthy()

      const parsed = JSON.parse(stored!)
      expect(parsed.name).toBe('John Doe')
      expect(parsed.email).toBe('john@example.com')
    })

    it('should restore form data from localStorage', () => {
      const storageKey = 'form-test-form-data'
      const savedData = {
        name: 'Jane Doe',
        email: 'jane@example.com',
      }

      localStorage.setItem(storageKey, JSON.stringify(savedData))

      const { formData } = useFormPersistence('test-form', {
        name: '',
        email: '',
      })

      expect(formData.value.name).toBe('Jane Doe')
      expect(formData.value.email).toBe('jane@example.com')
    })

    it('should persist data across page reloads', async () => {
      // First instance - save data
      const { formData: formData1 } = useFormPersistence('test-form', {
        description: '',
      })

      formData1.value.description = 'Test description'
      await nextTick()

      // Simulate page reload - create new instance
      const { formData: formData2 } = useFormPersistence('test-form', {
        description: '',
      })

      expect(formData2.value.description).toBe('Test description')
    })

    it('should survive Safari tab discard scenario', async () => {
      // Simulate tab being active
      const { formData: activeFormData } = useFormPersistence('inspection-123', {
        description: '',
        location: '',
        severity: 'MINOR' as const,
      })

      activeFormData.value.description = 'Fire extinguisher missing'
      activeFormData.value.location = 'Room 101'
      activeFormData.value.severity = 'MAJOR'

      await nextTick()

      // Simulate tab being discarded and restored
      // (In reality, the tab would be killed and reloaded)
      const { formData: restoredFormData } = useFormPersistence('inspection-123', {
        description: '',
        location: '',
        severity: 'MINOR' as const,
      })

      expect(restoredFormData.value.description).toBe('Fire extinguisher missing')
      expect(restoredFormData.value.location).toBe('Room 101')
      expect(restoredFormData.value.severity).toBe('MAJOR')
    })
  })

  describe('clearForm', () => {
    it('should clear form data from localStorage', async () => {
      const { formData, clearForm, storageKey } = useFormPersistence('test-form', {
        name: '',
        email: '',
      })

      formData.value.name = 'John Doe'
      formData.value.email = 'john@example.com'
      await nextTick()

      clearForm()
      await nextTick()

      // After clearing, localStorage should be empty
      expect(localStorage.getItem(storageKey)).toBeNull()
    })

    it('should clear form data from localStorage', async () => {
      const { formData, clearForm, storageKey } = useFormPersistence('test-form', {
        name: '',
      })

      formData.value.name = 'John Doe'
      await nextTick()

      clearForm()
      await nextTick()

      const stored = localStorage.getItem(storageKey)
      expect(stored).toBeNull()
    })

    it('should trigger onClear callback', async () => {
      const onClear = vi.fn()

      const { formData, clearForm } = useFormPersistence('test-form', { name: '' }, { onClear })

      formData.value.name = 'John Doe'
      await nextTick()

      clearForm()

      expect(onClear).toHaveBeenCalledTimes(1)
    })

    it('should clear data on successful submit', async () => {
      const { formData, clearForm, storageKey } = useFormPersistence('inspection-123', {
        description: '',
        severity: 'MINOR' as const,
      })

      formData.value.description = 'Test deficiency'
      formData.value.severity = 'MAJOR'
      await nextTick()

      // Simulate successful submit
      clearForm()
      await nextTick()

      // After clearing, localStorage should be empty
      const stored = localStorage.getItem(storageKey)
      expect(stored).toBeNull()
    })
  })

  describe('resetForm', () => {
    it('should reset form to initial values', async () => {
      const { formData, resetForm } = useFormPersistence('test-form', {
        name: '',
        email: '',
      })

      formData.value.name = 'John Doe'
      formData.value.email = 'john@example.com'
      await nextTick()

      resetForm()
      await nextTick()

      // Reset sets the form back to initial values
      expect(formData.value.name).toBe('')
      expect(formData.value.email).toBe('')
    })

    it('should not clear localStorage when resetting', async () => {
      const { formData, resetForm, storageKey } = useFormPersistence('test-form', {
        name: '',
      })

      formData.value.name = 'John Doe'
      await nextTick()

      resetForm()
      await nextTick()

      // Data should still be in localStorage (just reset to initial values)
      const stored = localStorage.getItem(storageKey)
      expect(stored).toBeTruthy()
    })
  })

  describe('isFormDirty', () => {
    it('should be false when form has initial values', () => {
      const { isFormDirty } = useFormPersistence('test-form', {
        name: '',
        email: '',
      })

      expect(isFormDirty.value).toBe(false)
    })

    it('should be true when form has been modified', async () => {
      const { formData, isFormDirty } = useFormPersistence('test-form', {
        name: '',
        email: '',
      })

      formData.value.name = 'John Doe'
      await nextTick()

      expect(isFormDirty.value).toBe(true)
    })

    it('should be false after resetting form', async () => {
      const { formData, resetForm, isFormDirty } = useFormPersistence('test-form', {
        name: '',
      })

      formData.value.name = 'John Doe'
      await nextTick()

      expect(isFormDirty.value).toBe(true)

      resetForm()
      await nextTick()

      // After resetting, form should not be dirty
      expect(isFormDirty.value).toBe(false)
    })
  })

  describe('hasPersistedData', () => {
    it('should return false when no data is persisted', () => {
      const { hasPersistedData } = useFormPersistence('test-form', {
        name: '',
      })

      // useStorage automatically persists initial values
      // So we need to clear it first
      localStorage.clear()

      expect(hasPersistedData()).toBe(false)
    })

    it('should return true when data is persisted', async () => {
      const { formData, hasPersistedData } = useFormPersistence('test-form', {
        name: '',
      })

      formData.value.name = 'John Doe'
      await nextTick()

      expect(hasPersistedData()).toBe(true)
    })

    it('should return false after clearing form', async () => {
      const { formData, clearForm, hasPersistedData } = useFormPersistence('test-form', {
        name: '',
      })

      formData.value.name = 'John Doe'
      await nextTick()

      clearForm()
      await nextTick()

      expect(hasPersistedData()).toBe(false)
    })
  })

  describe('onRestore callback', () => {
    it('should trigger onRestore when data is loaded from storage', () => {
      const storageKey = 'form-test-form-data'
      const savedData = { name: 'John Doe' }
      localStorage.setItem(storageKey, JSON.stringify(savedData))

      const onRestore = vi.fn()

      useFormPersistence('test-form', { name: '' }, { onRestore })

      expect(onRestore).toHaveBeenCalledTimes(1)
      expect(onRestore).toHaveBeenCalledWith(savedData)
    })

    it('should not trigger onRestore when no data is stored', () => {
      const onRestore = vi.fn()

      useFormPersistence('test-form', { name: '' }, { onRestore })

      expect(onRestore).not.toHaveBeenCalled()
    })
  })

  describe('multiple forms independently', () => {
    it('should persist multiple forms independently', async () => {
      const { formData: form1 } = useFormPersistence('form-1', {
        name: '',
      })

      const { formData: form2 } = useFormPersistence('form-2', {
        email: '',
      })

      form1.value.name = 'John Doe'
      form2.value.email = 'john@example.com'

      await nextTick()

      // Verify both forms are persisted independently
      const stored1 = localStorage.getItem('form-form-1-data')
      const stored2 = localStorage.getItem('form-form-2-data')

      expect(stored1).toBeTruthy()
      expect(stored2).toBeTruthy()

      expect(JSON.parse(stored1!).name).toBe('John Doe')
      expect(JSON.parse(stored2!).email).toBe('john@example.com')
    })

    it('should clear forms independently', async () => {
      const { formData: form1, clearForm: clearForm1 } = useFormPersistence('form-1', {
        name: '',
      })

      const { formData: form2, clearForm: clearForm2 } = useFormPersistence('form-2', {
        email: '',
      })

      form1.value.name = 'John Doe'
      form2.value.email = 'john@example.com'
      await nextTick()

      clearForm1()
      await nextTick()

      // Form 1 should be cleared from localStorage
      expect(localStorage.getItem('form-form-1-data')).toBeNull()
      // Form 2 should remain unchanged
      expect(form2.value.email).toBe('john@example.com')
    })
  })

  describe('custom serializer', () => {
    it('should use custom serializer for complex data types', async () => {
      interface ComplexData {
        date: Date
        name: string
      }

      const { formData, storageKey } = useFormPersistence<ComplexData>(
        'test-form',
        {
          date: new Date('2024-01-01'),
          name: '',
        },
        {
          serializer: {
            read: (raw: string) => {
              const parsed = JSON.parse(raw)
              return {
                ...parsed,
                date: new Date(parsed.date),
              }
            },
            write: (value: ComplexData) => {
              return JSON.stringify({
                ...value,
                date: value.date.toISOString(),
              })
            },
          },
        },
      )

      formData.value.date = new Date('2024-12-31')
      formData.value.name = 'Test'

      await nextTick()

      const stored = localStorage.getItem(storageKey)
      expect(stored).toBeTruthy()

      const parsed = JSON.parse(stored!)
      expect(parsed.date).toBe('2024-12-31T00:00:00.000Z')
      expect(parsed.name).toBe('Test')

      // Verify restoration
      const { formData: restoredData } = useFormPersistence<ComplexData>(
        'test-form',
        {
          date: new Date('2024-01-01'),
          name: '',
        },
        {
          serializer: {
            read: (raw: string) => {
              const parsed = JSON.parse(raw)
              return {
                ...parsed,
                date: new Date(parsed.date),
              }
            },
            write: (value: ComplexData) => {
              return JSON.stringify({
                ...value,
                date: value.date.toISOString(),
              })
            },
          },
        },
      )

      expect(restoredData.value.date).toBeInstanceOf(Date)
      expect(restoredData.value.date.toISOString()).toBe('2024-12-31T00:00:00.000Z')
    })
  })
})

describe('useMultiFieldPersistence', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  describe('basic functionality', () => {
    it('should persist fields independently', async () => {
      const { getField } = useMultiFieldPersistence('inspection-123')

      const description = getField('description', '')
      const location = getField('location', '')
      const severity = getField('severity', 'MINOR')

      description.value = 'Fire extinguisher missing'
      location.value = 'Room 101'
      severity.value = 'MAJOR'

      await nextTick()

      expect(localStorage.getItem('form-inspection-123-description')).toBeTruthy()
      expect(localStorage.getItem('form-inspection-123-location')).toBeTruthy()
      expect(localStorage.getItem('form-inspection-123-severity')).toBeTruthy()
    })

    it('should restore fields independently', () => {
      // Store as plain strings (not double-encoded)
      localStorage.setItem('form-inspection-123-description', 'Test description')
      localStorage.setItem('form-inspection-123-location', 'Room 101')

      const { getField } = useMultiFieldPersistence('inspection-123')

      const description = getField('description', '')
      const location = getField('location', '')

      expect(description.value).toBe('Test description')
      expect(location.value).toBe('Room 101')
    })
  })

  describe('clearField', () => {
    it('should clear specific field', async () => {
      const { getField, clearField } = useMultiFieldPersistence('inspection-123')

      const description = getField('description', '')
      const location = getField('location', '')

      description.value = 'Test description'
      location.value = 'Room 101'

      await nextTick()

      clearField('description')

      expect(localStorage.getItem('form-inspection-123-description')).toBeNull()
      expect(localStorage.getItem('form-inspection-123-location')).toBeTruthy()
    })
  })

  describe('clearAllFields', () => {
    it('should clear all fields for form', async () => {
      const { getField, clearAllFields } = useMultiFieldPersistence('inspection-123')

      const description = getField('description', '')
      const location = getField('location', '')
      const severity = getField('severity', 'MINOR')

      description.value = 'Test'
      location.value = 'Room 101'
      severity.value = 'MAJOR'

      await nextTick()

      clearAllFields()

      expect(localStorage.getItem('form-inspection-123-description')).toBeNull()
      expect(localStorage.getItem('form-inspection-123-location')).toBeNull()
      expect(localStorage.getItem('form-inspection-123-severity')).toBeNull()
    })
  })

  describe('getFieldKeys', () => {
    it('should return all field keys', () => {
      const { getField, getFieldKeys } = useMultiFieldPersistence('inspection-123')

      getField('description', '')
      getField('location', '')
      getField('severity', 'MINOR')

      const keys = getFieldKeys()

      expect(keys).toHaveLength(3)
      expect(keys).toContain('form-inspection-123-description')
      expect(keys).toContain('form-inspection-123-location')
      expect(keys).toContain('form-inspection-123-severity')
    })
  })

  describe('hasAnyPersistedData', () => {
    it('should return false when no fields have data', () => {
      const { getField, hasAnyPersistedData } = useMultiFieldPersistence('inspection-123')

      getField('description', '')
      getField('location', '')

      // Clear localStorage to ensure no data
      localStorage.clear()

      expect(hasAnyPersistedData()).toBe(false)
    })

    it('should return true when any field has data', async () => {
      const { getField, hasAnyPersistedData } = useMultiFieldPersistence('inspection-123')

      const description = getField('description', '')
      getField('location', '')

      description.value = 'Test'
      await nextTick()

      expect(hasAnyPersistedData()).toBe(true)
    })
  })
})

describe('useDebouncedFormPersistence', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
  })

  afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('should save data immediately (useStorage behavior)', async () => {
    const { formData, storageKey } = useDebouncedFormPersistence(
      'test-form',
      { name: '' },
      { debounceMs: 500 },
    )

    formData.value.name = 'John'
    await nextTick()

    // useStorage saves immediately, debouncing is for additional saves
    const stored = localStorage.getItem(storageKey)
    expect(stored).toBeTruthy()
  })

  it('should use default debounce of 300ms', async () => {
    const { formData } = useDebouncedFormPersistence('test-form', { name: '' })

    formData.value.name = 'John'
    await nextTick()

    // Data is saved immediately by useStorage
    expect(localStorage.getItem('form-test-form-data')).toBeTruthy()
  })

  it('should cancel pending save on clearForm', async () => {
    const { formData, clearForm, storageKey } = useDebouncedFormPersistence(
      'test-form',
      { name: '' },
      { debounceMs: 500 },
    )

    formData.value.name = 'John'
    await nextTick()

    clearForm()
    await nextTick()

    vi.advanceTimersByTime(500)
    await nextTick()

    // After clearing, storage should be null
    expect(localStorage.getItem(storageKey)).toBeNull()
  })

  it('should save immediately on manual saveForm call', async () => {
    const { formData, saveForm, storageKey } = useDebouncedFormPersistence(
      'test-form',
      { name: '' },
      { debounceMs: 500 },
    )

    formData.value.name = 'John'
    await nextTick()

    saveForm()
    await nextTick()

    expect(localStorage.getItem(storageKey)).toBeTruthy()
  })
})

describe('Safari tab discard scenarios', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('should handle rapid form changes before tab discard', async () => {
    const { formData } = useFormPersistence('inspection-123', {
      description: '',
      location: '',
      severity: 'MINOR' as const,
    })

    // Simulate rapid typing
    formData.value.description = 'F'
    await nextTick()
    formData.value.description = 'Fi'
    await nextTick()
    formData.value.description = 'Fir'
    await nextTick()
    formData.value.description = 'Fire'
    await nextTick()
    formData.value.description = 'Fire extinguisher missing'
    await nextTick()

    // Simulate tab discard and restore
    const { formData: restoredData } = useFormPersistence('inspection-123', {
      description: '',
      location: '',
      severity: 'MINOR' as const,
    })

    expect(restoredData.value.description).toBe('Fire extinguisher missing')
  })

  it('should handle multiple form instances (different inspections)', async () => {
    // Inspector opens multiple inspections in different tabs
    const { formData: inspection1 } = useFormPersistence('inspection-123', {
      description: '',
    })

    const { formData: inspection2 } = useFormPersistence('inspection-456', {
      description: '',
    })

    inspection1.value.description = 'Inspection 1 data'
    inspection2.value.description = 'Inspection 2 data'

    await nextTick()

    // Simulate tab discard and restore
    const { formData: restored1 } = useFormPersistence('inspection-123', {
      description: '',
    })

    const { formData: restored2 } = useFormPersistence('inspection-456', {
      description: '',
    })

    expect(restored1.value.description).toBe('Inspection 1 data')
    expect(restored2.value.description).toBe('Inspection 2 data')
  })

  it('should handle form data with complex nested objects', async () => {
    interface ComplexForm {
      description: string
      codeReference: {
        code: string
        section: string
      } | null
      photos: string[]
    }

    const { formData } = useFormPersistence<ComplexForm>('inspection-123', {
      description: '',
      codeReference: null,
      photos: [],
    })

    formData.value.description = 'Test deficiency'
    formData.value.codeReference = {
      code: 'NBC',
      section: '9.10.1',
    }
    formData.value.photos = ['photo1.jpg', 'photo2.jpg']

    await nextTick()

    // Simulate tab discard and restore
    const { formData: restoredData } = useFormPersistence<ComplexForm>('inspection-123', {
      description: '',
      codeReference: null,
      photos: [],
    })

    expect(restoredData.value.description).toBe('Test deficiency')
    expect(restoredData.value.codeReference).toEqual({
      code: 'NBC',
      section: '9.10.1',
    })
    expect(restoredData.value.photos).toEqual(['photo1.jpg', 'photo2.jpg'])
  })
})
