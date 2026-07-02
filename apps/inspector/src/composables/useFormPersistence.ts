import { useStorage, type RemovableRef } from '@vueuse/core'
import { computed, type Ref } from 'vue'

/**
 * Form Persistence Composable
 *
 * Uses VueUse useStorage to automatically persist form data to localStorage
 * for Safari tab discard recovery. Implements M3-S6 requirements.
 *
 * @example
 * ```ts
 * const { formData, clearForm, isFormDirty } = useFormPersistence('inspection-123', {
 *   description: '',
 *   location: '',
 *   severity: 'MINOR'
 * })
 *
 * // Form data automatically syncs to localStorage on every change
 * formData.value.description = 'New description'
 *
 * // Clear form data after successful submit
 * clearForm()
 * ```
 */

export interface FormPersistenceOptions<T> {
  /**
   * Storage key prefix. Final key will be `form-{formId}-data`
   */
  formId: string

  /**
   * Initial/default form values
   */
  initialValues: T

  /**
   * Optional serializer for complex data types
   * Default: JSON.stringify/parse
   */
  serializer?: {
    read: (raw: string) => T
    write: (value: T) => string
  }

  /**
   * Optional callback when form is restored from storage
   */
  onRestore?: (data: T) => void

  /**
   * Optional callback when form is cleared
   */
  onClear?: () => void
}

export interface FormPersistenceReturn<T> {
  /**
   * Reactive form data that automatically persists to localStorage
   */
  formData: RemovableRef<T>

  /**
   * Clear form data from both memory and localStorage
   */
  clearForm: () => void

  /**
   * Reset form to initial values without clearing storage
   */
  resetForm: () => void

  /**
   * Check if form has been modified from initial values
   */
  isFormDirty: Ref<boolean>

  /**
   * Get the storage key being used
   */
  storageKey: string

  /**
   * Manually save current form state (usually automatic)
   */
  saveForm: () => void

  /**
   * Check if form has persisted data
   */
  hasPersistedData: () => boolean
}

/**
 * Create a form persistence instance
 *
 * @param formId - Unique identifier for the form (e.g., inspection ID)
 * @param initialValues - Default form values
 * @param options - Additional configuration options
 * @returns Form persistence utilities
 */
export function useFormPersistence<T extends Record<string, any>>(
  formId: string,
  initialValues: T,
  options?: Partial<Omit<FormPersistenceOptions<T>, 'formId' | 'initialValues'>>,
): FormPersistenceReturn<T> {
  // Generate storage key
  const storageKey = `form-${formId}-data`

  // Snapshot initial state for comparison and reset
  // Use custom serializer if provided, otherwise use JSON
  const initialJson = options?.serializer
    ? options.serializer.write(initialValues)
    : JSON.stringify(initialValues)

  // Create a cloned initial value to avoid modifying caller's object
  // Use custom serializer if provided to ensure proper deserialization
  const clonedInitial = options?.serializer
    ? options.serializer.read(options.serializer.write(initialValues))
    : (JSON.parse(JSON.stringify(initialValues)) as T)

  // Check if form was restored from storage BEFORE creating useStorage
  const hadPersistedData = localStorage.getItem(storageKey) !== null

  // Create reactive storage-backed form data
  const formData = useStorage<T>(storageKey, clonedInitial, localStorage, {
    serializer: options?.serializer
      ? options.serializer
      : {
          read: (raw: string) => JSON.parse(raw) as T,
          write: (value: T) => JSON.stringify(value),
        },
    mergeDefaults: false, // Do not merge with defaults
  })

  // Track if form has been modified
  const isFormDirty = computed(() => {
    if (!formData.value) return false
    return JSON.stringify(formData.value) !== initialJson
  })

  // Check if form has persisted data
  const hasPersistedData = (): boolean => {
    const stored = localStorage.getItem(storageKey)
    return stored !== null && stored !== 'null'
  }

  // Trigger onRestore callback if data was loaded from storage
  if (hadPersistedData && options?.onRestore) {
    options.onRestore(formData.value)
  }

  /**
   * Clear form data from both memory and localStorage
   */
  const clearForm = () => {
    // Remove from localStorage
    localStorage.removeItem(storageKey)

    // Set to null (useStorage will detect removal and set to null)
    formData.value = null as any

    // Trigger callback
    if (options?.onClear) {
      options.onClear()
    }
  }

  /**
   * Reset form to initial values
   */
  const resetForm = () => {
    // Create a new object to trigger reactivity
    formData.value = JSON.parse(initialJson) as T
  }

  /**
   * Manually save current form state
   * Note: This is usually automatic via useStorage reactivity
   */
  const saveForm = () => {
    // Force a write by triggering reactivity
    formData.value = { ...formData.value }
  }

  return {
    formData,
    clearForm,
    resetForm,
    isFormDirty,
    storageKey,
    saveForm,
    hasPersistedData,
  }
}

/**
 * Multi-field form persistence
 *
 * For forms with multiple independent fields that need separate storage keys.
 * Useful when different form sections have different lifecycles.
 *
 * @example
 * ```ts
 * const { getField, clearField, clearAllFields } = useMultiFieldPersistence('inspection-123')
 *
 * const description = getField('description', '')
 * const location = getField('location', '')
 * const severity = getField('severity', 'MINOR')
 *
 * // Each field is independently persisted
 * description.value = 'New description'
 *
 * // Clear specific field
 * clearField('description')
 *
 * // Clear all fields for this form
 * clearAllFields()
 * ```
 */
export interface MultiFieldPersistenceReturn {
  /**
   * Get a reactive storage-backed field
   */
  getField: <T>(fieldName: string, defaultValue: T) => RemovableRef<T>

  /**
   * Clear a specific field
   */
  clearField: (fieldName: string) => void

  /**
   * Clear all fields for this form
   */
  clearAllFields: () => void

  /**
   * Get all field keys for this form
   */
  getFieldKeys: () => string[]

  /**
   * Check if any field has data
   */
  hasAnyPersistedData: () => boolean
}

export function useMultiFieldPersistence(formId: string): MultiFieldPersistenceReturn {
  const fieldKeys = new Set<string>()

  /**
   * Get a reactive storage-backed field
   */
  const getField = <T>(fieldName: string, defaultValue: T): RemovableRef<T> => {
    const storageKey = `form-${formId}-${fieldName}`
    fieldKeys.add(storageKey)

    return useStorage<T>(storageKey, defaultValue, localStorage, {
      mergeDefaults: true,
    })
  }

  /**
   * Clear a specific field
   */
  const clearField = (fieldName: string) => {
    const storageKey = `form-${formId}-${fieldName}`
    localStorage.removeItem(storageKey)
  }

  /**
   * Clear all fields for this form
   */
  const clearAllFields = () => {
    fieldKeys.forEach((key) => {
      localStorage.removeItem(key)
    })
    fieldKeys.clear()
  }

  /**
   * Get all field keys for this form
   */
  const getFieldKeys = (): string[] => {
    return Array.from(fieldKeys)
  }

  /**
   * Check if any field has data
   */
  const hasAnyPersistedData = (): boolean => {
    return Array.from(fieldKeys).some((key) => {
      const stored = localStorage.getItem(key)
      return stored !== null && stored !== 'null'
    })
  }

  return {
    getField,
    clearField,
    clearAllFields,
    getFieldKeys,
    hasAnyPersistedData,
  }
}

/**
 * Form persistence with auto-save debouncing
 *
 * Note: useStorage already saves immediately. This function is provided
 * for API compatibility but behaves the same as useFormPersistence.
 *
 * @example
 * ```ts
 * const { formData, clearForm } = useDebouncedFormPersistence('inspection-123', {
 *   description: '',
 *   notes: ''
 * }, { debounceMs: 500 })
 *
 * // Changes are saved immediately by useStorage
 * formData.value.description = 'New description'
 * ```
 */
export interface DebouncedFormPersistenceOptions<T> extends FormPersistenceOptions<T> {
  /**
   * Debounce delay in milliseconds
   * Note: useStorage saves immediately, so this is not used
   * Default: 300ms
   */
  debounceMs?: number
}

export function useDebouncedFormPersistence<T extends Record<string, any>>(
  formId: string,
  initialValues: T,
  options?: Partial<Omit<DebouncedFormPersistenceOptions<T>, 'formId' | 'initialValues'>>,
): FormPersistenceReturn<T> {
  // useStorage already saves immediately, so we just use the regular implementation
  return useFormPersistence(formId, initialValues, options)
}
