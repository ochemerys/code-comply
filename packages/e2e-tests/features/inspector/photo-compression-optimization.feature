# M11-S9: Optimized image compression pipeline (≤500 KB, quality 0.8, <2s, mobile-friendly)
# Executable coverage: @codecomply/inspector vitest — compression.spec.ts, photo-compression-performance.spec.ts

@M11-S9 @inspector @performance
Feature: Inspection photo compression optimization
  As an inspector
  I want photos compressed quickly without losing inspection usefulness
  So that evidence stays small on device and syncs efficiently on mobile hardware

  Scenario: M11-S9 compression acceptance criteria are covered by automated tests
    Given the photo compression acceptance criteria are defined for M11-S9
    Then unit and integration tests should cover M11-S9 size, speed, and memory targets
