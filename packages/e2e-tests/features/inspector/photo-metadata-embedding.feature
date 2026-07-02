# M7-S3: Photo metadata embedding (timestamp, GPS, inspector, permit, device, optional watermark)
# Executable coverage: @codecomply/inspector vitest — src/lib/photo/metadata.spec.ts and __tests__/integration/photo-metadata.spec.ts

Feature: Photo metadata embedding
  As an inspector
  I want captured photos to carry structured metadata and optional watermarks
  So that evidence is traceable in the field and in compliance records

  Scenario: Photo metadata acceptance criteria for M7-S3 are covered by automated tests
    Given the photo metadata embedding acceptance criteria are defined for M7-S3
    Then unit and integration tests should cover metadata fields and watermark rendering
