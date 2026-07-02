# M7-S4: Image compression before storage (≤500 KB, configurable, JPEG, web worker default)
# Executable coverage: @codecomply/inspector vitest — src/lib/photo/compression.spec.ts and __tests__/integration/photo-compression.spec.ts

Feature: Inspection photo compression
  As an inspector
  I want photos compressed before they are stored
  So that evidence stays small on device and syncs efficiently without losing inspection usefulness

  Scenario: Photo compression acceptance criteria for M7-S4 are covered by automated tests
    Given the photo compression acceptance criteria are defined for M7-S4
    Then unit and integration tests should cover size targets and configurable options
