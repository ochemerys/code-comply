import { z } from 'zod'

/**
 * GPS Coordinates DTO
 * Used for location-based features (permit discovery, geofencing)
 */
export const GPSCoordinatesDTOSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().positive().optional(),
  altitude: z.number().optional(),
  altitudeAccuracy: z.number().positive().optional(),
  heading: z.number().min(0).max(360).optional(),
  speed: z.number().nonnegative().optional(),
  timestamp: z.string().datetime().optional(),
})
export type GPSCoordinatesDTO = z.infer<typeof GPSCoordinatesDTOSchema>

/**
 * GPS Position DTO
 * Extended GPS information including metadata
 */
export const GPSPositionDTOSchema = z.object({
  coords: GPSCoordinatesDTOSchema,
  timestamp: z.string().datetime(),
  source: z.enum(['gps', 'network', 'manual']).default('gps'),
})
export type GPSPositionDTO = z.infer<typeof GPSPositionDTOSchema>

/**
 * GPS Bounding Box DTO
 * Used for area-based searches
 */
export const GPSBoundingBoxDTOSchema = z.object({
  northEast: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }),
  southWest: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }),
})
export type GPSBoundingBoxDTO = z.infer<typeof GPSBoundingBoxDTOSchema>

/**
 * GPS Distance DTO
 * Used for calculating and displaying distances
 */
export const GPSDistanceDTOSchema = z.object({
  meters: z.number().nonnegative(),
  kilometers: z.number().nonnegative(),
  miles: z.number().nonnegative(),
  formatted: z.string(), // e.g., "1.5 km", "0.9 mi"
})
export type GPSDistanceDTO = z.infer<typeof GPSDistanceDTOSchema>

/**
 * Geofence DTO
 * Used for geofence warnings and validation
 */
export const GeofenceDTOSchema = z.object({
  center: GPSCoordinatesDTOSchema,
  radius: z.number().positive(), // Radius in meters
  name: z.string().optional(),
  description: z.string().optional(),
})
export type GeofenceDTO = z.infer<typeof GeofenceDTOSchema>

/**
 * Geofence Validation Result DTO
 * Used for checking if a location is within a geofence
 */
export const GeofenceValidationResultDTOSchema = z.object({
  isWithinGeofence: z.boolean(),
  distance: GPSDistanceDTOSchema,
  geofence: GeofenceDTOSchema,
  currentPosition: GPSCoordinatesDTOSchema,
})
export type GeofenceValidationResultDTO = z.infer<typeof GeofenceValidationResultDTOSchema>
