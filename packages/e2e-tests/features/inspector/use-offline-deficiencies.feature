# M6-S17: useOfflineDeficiencies — IndexedDB + sync queue + conflict handling
# Executable coverage: @codecomply/inspector vitest (unit + integration).

Feature: Offline deficiency storage composable behavior
  As an inspector using the Safety Codes Inspection PWA
  I need deficiencies stored in IndexedDB with a sync queue and reconciliation
  So that I can record findings offline and merge server updates safely

  @M6-S17
  Scenario: Offline deficiency storage acceptance criteria are documented and covered by tests
    Given the offline deficiencies composable acceptance criteria are defined for M6-S17
    Then unit and integration tests should cover offline CRUD, sync queue, and conflict resolution
