import { describe, it, expect } from 'vitest'
import {
  formatDate,
  formatDateShort,
  formatDateTime,
  formatRelativeDate,
  formatRelativeToDate,
  isValidDate,
  getCurrentTimestamp,
  getDaysDifference,
  getStartOfDay,
  getEndOfDay,
  addDaysToDate,
  subtractDaysFromDate,
} from './date'

describe('Date Utilities', () => {
  describe('formatDate', () => {
    it('should format a date string', () => {
      const result = formatDate('2024-01-15T10:30:00.000Z', 'yyyy-MM-dd')
      expect(result).toBe('2024-01-15')
    })

    it('should format a Date object', () => {
      const date = new Date('2024-01-15T10:30:00.000Z')
      const result = formatDate(date, 'yyyy-MM-dd')
      expect(result).toBe('2024-01-15')
    })

    it('should return "Invalid date" for invalid input', () => {
      const result = formatDate('not-a-date')
      expect(result).toBe('Invalid date')
    })
  })

  describe('formatDateShort', () => {
    it('should format to short date', () => {
      const result = formatDateShort('2024-01-15T10:30:00.000Z')
      expect(result).toContain('Jan')
      expect(result).toContain('15')
      expect(result).toContain('2024')
    })
  })

  describe('formatDateTime', () => {
    it('should format with time', () => {
      const result = formatDateTime('2024-01-15T10:30:00.000Z')
      expect(result).toContain('Jan')
      expect(result).toContain('15')
      expect(result).toContain('2024')
    })
  })

  describe('formatRelativeDate', () => {
    it('should return relative time string', () => {
      const result = formatRelativeDate(new Date())
      expect(result).toContain('ago') // "less than a minute ago" or similar
    })

    it('should return "Invalid date" for invalid input', () => {
      const result = formatRelativeDate('not-a-date')
      expect(result).toBe('Invalid date')
    })
  })

  describe('isValidDate', () => {
    it('should return true for valid dates', () => {
      expect(isValidDate('2024-01-15T10:30:00.000Z')).toBe(true)
      expect(isValidDate(new Date())).toBe(true)
    })

    it('should return false for invalid dates', () => {
      expect(isValidDate('not-a-date')).toBe(false)
    })
  })

  describe('getCurrentTimestamp', () => {
    it('should return an ISO string', () => {
      const result = getCurrentTimestamp()
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
    })
  })

  describe('getDaysDifference', () => {
    it('should calculate days between two dates', () => {
      const result = getDaysDifference('2024-01-20', '2024-01-15')
      expect(result).toBe(5)
    })
  })

  describe('formatRelativeToDate', () => {
    it('should format relative to a base date', () => {
      const result = formatRelativeToDate(
        '2024-01-14T12:00:00.000Z',
        new Date('2024-01-15T12:00:00.000Z'),
      )
      expect(result.toLowerCase()).toContain('yesterday')
    })

    it('should return "Invalid date" for invalid input', () => {
      expect(formatRelativeToDate('not-a-date')).toBe('Invalid date')
    })
  })

  describe('day boundary helpers', () => {
    it('getStartOfDay returns midnight for the given date', () => {
      const start = getStartOfDay('2024-01-15T15:30:00.000Z')
      expect(start.getHours()).toBe(0)
      expect(start.getMinutes()).toBe(0)
    })

    it('getEndOfDay returns end of day for the given date', () => {
      const end = getEndOfDay('2024-01-15T15:30:00.000Z')
      expect(end.getHours()).toBe(23)
      expect(end.getMinutes()).toBe(59)
    })
  })

  describe('addDaysToDate and subtractDaysFromDate', () => {
    it('adds days to a date string', () => {
      const result = addDaysToDate('2024-01-15', 3)
      expect(result.getDate()).toBe(18)
    })

    it('subtracts days from a Date object', () => {
      const result = subtractDaysFromDate(new Date('2024-01-15T12:00:00.000Z'), 2)
      expect(result.getDate()).toBe(13)
    })
  })
})
