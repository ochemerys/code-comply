# M5-S15: Cache checklist templates in IndexedDB
# Executable coverage: @codecomply/inspector vitest (unit + integration).

Feature: Offline checklist template cache
  As an inspector using the Safety Codes Inspection PWA
  I need checklist templates cached locally
  So that I can run checklists offline with the correct version

  @M5-S15
  Scenario: Checklist template cache acceptance criteria are covered by automated tests
    Given the offline checklist template cache acceptance criteria are defined for M5-S15
    Then unit and integration tests should cover caching, offline load, version hash, and cache cleanup
