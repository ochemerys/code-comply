import {
  format,
  formatDistance,
  formatRelative,
  parseISO,
  isValid,
  startOfDay,
  endOfDay,
  addDays,
  subDays,
  differenceInDays,
} from 'date-fns'

/**
 * Format a date string or Date object to a readable format
 */
export function formatDate(date: string | Date, formatStr: string = 'PPP'): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date

  if (!isValid(dateObj)) {
    return 'Invalid date'
  }

  return format(dateObj, formatStr)
}

/**
 * Format a date to a short format (e.g., "Jan 1, 2024")
 */
export function formatDateShort(date: string | Date): string {
  return formatDate(date, 'MMM d, yyyy')
}

/**
 * Format a date to include time (e.g., "Jan 1, 2024 at 3:30 PM")
 */
export function formatDateTime(date: string | Date): string {
  return formatDate(date, 'PPP p')
}

/**
 * Format a date relative to now (e.g., "2 hours ago")
 */
export function formatRelativeDate(date: string | Date): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date

  if (!isValid(dateObj)) {
    return 'Invalid date'
  }

  return formatDistance(dateObj, new Date(), { addSuffix: true })
}

/**
 * Format a date relative to a base date (e.g., "yesterday at 3:30 PM")
 */
export function formatRelativeToDate(date: string | Date, baseDate: Date = new Date()): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date

  if (!isValid(dateObj)) {
    return 'Invalid date'
  }

  return formatRelative(dateObj, baseDate)
}

/**
 * Get the start of day for a given date
 */
export function getStartOfDay(date: string | Date): Date {
  const dateObj = typeof date === 'string' ? parseISO(date) : date
  return startOfDay(dateObj)
}

/**
 * Get the end of day for a given date
 */
export function getEndOfDay(date: string | Date): Date {
  const dateObj = typeof date === 'string' ? parseISO(date) : date
  return endOfDay(dateObj)
}

/**
 * Add days to a date
 */
export function addDaysToDate(date: string | Date, days: number): Date {
  const dateObj = typeof date === 'string' ? parseISO(date) : date
  return addDays(dateObj, days)
}

/**
 * Subtract days from a date
 */
export function subtractDaysFromDate(date: string | Date, days: number): Date {
  const dateObj = typeof date === 'string' ? parseISO(date) : date
  return subDays(dateObj, days)
}

/**
 * Get the difference in days between two dates
 */
export function getDaysDifference(date1: string | Date, date2: string | Date): number {
  const dateObj1 = typeof date1 === 'string' ? parseISO(date1) : date1
  const dateObj2 = typeof date2 === 'string' ? parseISO(date2) : date2
  return differenceInDays(dateObj1, dateObj2)
}

/**
 * Check if a date is valid
 */
export function isValidDate(date: string | Date): boolean {
  const dateObj = typeof date === 'string' ? parseISO(date) : date
  return isValid(dateObj)
}

/**
 * Get current ISO timestamp
 */
export function getCurrentTimestamp(): string {
  return new Date().toISOString()
}
