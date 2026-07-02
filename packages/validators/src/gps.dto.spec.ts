import { describe, it, expect } from 'vitest'
import {
  GPSCoordinatesDTOSchema,
  GPSPositionDTOSchema,
  GPSBoundingBoxDTOSchema,
  GPSDistanceDTOSchema,
  GeofenceDTOSchema,
  GeofenceValidationResultDTOSchema,
} from './gps.dto'

describe('GPS DTOs', () => {
  describe('GPSCoordinatesDTOSchema', () => {
    it('should accept valid GPS coordinates with all fields', () => {
      const validCoords = {
        latitude: 53.5461,
        longitude: -113.4938,
        accuracy: 10.5,
        altitude: 670.5,
        altitudeAccuracy: 5.2,
        heading: 180.5,
        speed: 15.3,
        timestamp: '2024-01-15T10:00:00Z',
      }

      const result = GPSCoordinatesDTOSchema.safeParse(validCoords)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.latitude).toBe(53.5461)
        expect(result.data.longitude).toBe(-113.4938)
        expect(result.data.accuracy).toBe(10.5)
        expect(result.data.altitude).toBe(670.5)
      }
    })

    it('should accept coordinates with only required fields', () => {
      const minimalCoords = {
        latitude: 53.5461,
        longitude: -113.4938,
      }

      const result = GPSCoordinatesDTOSchema.safeParse(minimalCoords)
      expect(result.success).toBe(true)
    })

    it('should reject latitude out of range', () => {
      const invalidCoords = [
        { latitude: -91, longitude: 0 },
        { latitude: 91, longitude: 0 },
        { latitude: -100, longitude: 0 },
        { latitude: 100, longitude: 0 },
      ]

      invalidCoords.forEach((coords) => {
        const result = GPSCoordinatesDTOSchema.safeParse(coords)
        expect(result.success).toBe(false)
      })
    })

    it('should reject longitude out of range', () => {
      const invalidCoords = [
        { latitude: 0, longitude: -181 },
        { latitude: 0, longitude: 181 },
        { latitude: 0, longitude: -200 },
        { latitude: 0, longitude: 200 },
      ]

      invalidCoords.forEach((coords) => {
        const result = GPSCoordinatesDTOSchema.safeParse(coords)
        expect(result.success).toBe(false)
      })
    })

    it('should reject negative accuracy', () => {
      const coords = {
        latitude: 53.5461,
        longitude: -113.4938,
        accuracy: -10,
      }

      const result = GPSCoordinatesDTOSchema.safeParse(coords)
      expect(result.success).toBe(false)
    })

    it('should reject negative altitudeAccuracy', () => {
      const coords = {
        latitude: 53.5461,
        longitude: -113.4938,
        altitudeAccuracy: -5,
      }

      const result = GPSCoordinatesDTOSchema.safeParse(coords)
      expect(result.success).toBe(false)
    })

    it('should reject heading out of range', () => {
      const invalidCoords = [
        { latitude: 0, longitude: 0, heading: -1 },
        { latitude: 0, longitude: 0, heading: 361 },
        { latitude: 0, longitude: 0, heading: 400 },
      ]

      invalidCoords.forEach((coords) => {
        const result = GPSCoordinatesDTOSchema.safeParse(coords)
        expect(result.success).toBe(false)
      })
    })

    it('should accept valid heading values', () => {
      const validHeadings = [0, 90, 180, 270, 360]

      validHeadings.forEach((heading) => {
        const coords = {
          latitude: 0,
          longitude: 0,
          heading,
        }
        const result = GPSCoordinatesDTOSchema.safeParse(coords)
        expect(result.success).toBe(true)
      })
    })

    it('should reject negative speed', () => {
      const coords = {
        latitude: 53.5461,
        longitude: -113.4938,
        speed: -10,
      }

      const result = GPSCoordinatesDTOSchema.safeParse(coords)
      expect(result.success).toBe(false)
    })

    it('should accept zero speed', () => {
      const coords = {
        latitude: 53.5461,
        longitude: -113.4938,
        speed: 0,
      }

      const result = GPSCoordinatesDTOSchema.safeParse(coords)
      expect(result.success).toBe(true)
    })
  })

  describe('GPSPositionDTOSchema', () => {
    it('should accept valid GPS position', () => {
      const validPosition = {
        coords: {
          latitude: 53.5461,
          longitude: -113.4938,
          accuracy: 10.5,
        },
        timestamp: '2024-01-15T10:00:00Z',
        source: 'gps',
      }

      const result = GPSPositionDTOSchema.safeParse(validPosition)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.source).toBe('gps')
      }
    })

    it('should apply default source', () => {
      const positionWithoutSource = {
        coords: {
          latitude: 53.5461,
          longitude: -113.4938,
        },
        timestamp: '2024-01-15T10:00:00Z',
      }

      const result = GPSPositionDTOSchema.safeParse(positionWithoutSource)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.source).toBe('gps')
      }
    })

    it('should accept all valid source types', () => {
      const validSources = ['gps', 'network', 'manual']

      validSources.forEach((source) => {
        const position = {
          coords: {
            latitude: 53.5461,
            longitude: -113.4938,
          },
          timestamp: '2024-01-15T10:00:00Z',
          source,
        }
        const result = GPSPositionDTOSchema.safeParse(position)
        expect(result.success).toBe(true)
      })
    })

    it('should reject invalid source type', () => {
      const invalidPosition = {
        coords: {
          latitude: 53.5461,
          longitude: -113.4938,
        },
        timestamp: '2024-01-15T10:00:00Z',
        source: 'invalid',
      }

      const result = GPSPositionDTOSchema.safeParse(invalidPosition)
      expect(result.success).toBe(false)
    })
  })

  describe('GPSBoundingBoxDTOSchema', () => {
    it('should accept valid bounding box', () => {
      const validBox = {
        northEast: {
          latitude: 53.6,
          longitude: -113.4,
        },
        southWest: {
          latitude: 53.5,
          longitude: -113.5,
        },
      }

      const result = GPSBoundingBoxDTOSchema.safeParse(validBox)
      expect(result.success).toBe(true)
    })

    it('should reject missing corners', () => {
      const invalidBoxes = [
        { northEast: { latitude: 53.6, longitude: -113.4 } }, // Missing southWest
        { southWest: { latitude: 53.5, longitude: -113.5 } }, // Missing northEast
        {}, // Missing both
      ]

      invalidBoxes.forEach((box) => {
        const result = GPSBoundingBoxDTOSchema.safeParse(box)
        expect(result.success).toBe(false)
      })
    })

    it('should reject invalid coordinates in corners', () => {
      const invalidBox = {
        northEast: {
          latitude: 100, // Out of range
          longitude: -113.4,
        },
        southWest: {
          latitude: 53.5,
          longitude: -113.5,
        },
      }

      const result = GPSBoundingBoxDTOSchema.safeParse(invalidBox)
      expect(result.success).toBe(false)
    })
  })

  describe('GPSDistanceDTOSchema', () => {
    it('should accept valid distance data', () => {
      const validDistance = {
        meters: 1500,
        kilometers: 1.5,
        miles: 0.932,
        formatted: '1.5 km',
      }

      const result = GPSDistanceDTOSchema.safeParse(validDistance)
      expect(result.success).toBe(true)
    })

    it('should accept zero distance', () => {
      const zeroDistance = {
        meters: 0,
        kilometers: 0,
        miles: 0,
        formatted: '0 m',
      }

      const result = GPSDistanceDTOSchema.safeParse(zeroDistance)
      expect(result.success).toBe(true)
    })

    it('should reject negative distances', () => {
      const invalidDistances = [
        { meters: -100, kilometers: 0, miles: 0, formatted: '-100 m' },
        { meters: 0, kilometers: -1, miles: 0, formatted: '-1 km' },
        { meters: 0, kilometers: 0, miles: -1, formatted: '-1 mi' },
      ]

      invalidDistances.forEach((distance) => {
        const result = GPSDistanceDTOSchema.safeParse(distance)
        expect(result.success).toBe(false)
      })
    })

    it('should reject missing required fields', () => {
      const invalidDistances = [
        { kilometers: 1.5, miles: 0.932, formatted: '1.5 km' }, // Missing meters
        { meters: 1500, miles: 0.932, formatted: '1.5 km' }, // Missing kilometers
        { meters: 1500, kilometers: 1.5, formatted: '1.5 km' }, // Missing miles
        { meters: 1500, kilometers: 1.5, miles: 0.932 }, // Missing formatted
      ]

      invalidDistances.forEach((distance) => {
        const result = GPSDistanceDTOSchema.safeParse(distance)
        expect(result.success).toBe(false)
      })
    })
  })

  describe('GeofenceDTOSchema', () => {
    it('should accept valid geofence', () => {
      const validGeofence = {
        center: {
          latitude: 53.5461,
          longitude: -113.4938,
        },
        radius: 5000,
        name: 'Edmonton Downtown',
        description: 'Downtown inspection area',
      }

      const result = GeofenceDTOSchema.safeParse(validGeofence)
      expect(result.success).toBe(true)
    })

    it('should accept geofence without optional fields', () => {
      const minimalGeofence = {
        center: {
          latitude: 53.5461,
          longitude: -113.4938,
        },
        radius: 5000,
      }

      const result = GeofenceDTOSchema.safeParse(minimalGeofence)
      expect(result.success).toBe(true)
    })

    it('should reject negative radius', () => {
      const invalidGeofence = {
        center: {
          latitude: 53.5461,
          longitude: -113.4938,
        },
        radius: -100,
      }

      const result = GeofenceDTOSchema.safeParse(invalidGeofence)
      expect(result.success).toBe(false)
    })

    it('should reject zero radius', () => {
      const invalidGeofence = {
        center: {
          latitude: 53.5461,
          longitude: -113.4938,
        },
        radius: 0,
      }

      const result = GeofenceDTOSchema.safeParse(invalidGeofence)
      expect(result.success).toBe(false)
    })
  })

  describe('GeofenceValidationResultDTOSchema', () => {
    it('should accept valid validation result', () => {
      const validResult = {
        isWithinGeofence: true,
        distance: {
          meters: 1500,
          kilometers: 1.5,
          miles: 0.932,
          formatted: '1.5 km',
        },
        geofence: {
          center: {
            latitude: 53.5461,
            longitude: -113.4938,
          },
          radius: 5000,
        },
        currentPosition: {
          latitude: 53.55,
          longitude: -113.5,
        },
      }

      const result = GeofenceValidationResultDTOSchema.safeParse(validResult)
      expect(result.success).toBe(true)
    })

    it('should accept result when outside geofence', () => {
      const outsideResult = {
        isWithinGeofence: false,
        distance: {
          meters: 6000,
          kilometers: 6,
          miles: 3.728,
          formatted: '6.0 km',
        },
        geofence: {
          center: {
            latitude: 53.5461,
            longitude: -113.4938,
          },
          radius: 5000,
        },
        currentPosition: {
          latitude: 53.6,
          longitude: -113.6,
        },
      }

      const result = GeofenceValidationResultDTOSchema.safeParse(outsideResult)
      expect(result.success).toBe(true)
    })

    it('should reject missing required fields', () => {
      const invalidResults = [
        {
          // Missing isWithinGeofence
          distance: { meters: 1500, kilometers: 1.5, miles: 0.932, formatted: '1.5 km' },
          geofence: { center: { latitude: 53.5461, longitude: -113.4938 }, radius: 5000 },
          currentPosition: { latitude: 53.55, longitude: -113.5 },
        },
        {
          isWithinGeofence: true,
          // Missing distance
          geofence: { center: { latitude: 53.5461, longitude: -113.4938 }, radius: 5000 },
          currentPosition: { latitude: 53.55, longitude: -113.5 },
        },
      ]

      invalidResults.forEach((result) => {
        const parseResult = GeofenceValidationResultDTOSchema.safeParse(result)
        expect(parseResult.success).toBe(false)
      })
    })
  })
})
