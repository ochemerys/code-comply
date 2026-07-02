# M5-S16: Store checklist execution state locally (IndexedDB + sync queue)
# Executable coverage: @codecomply/inspector vitest (unit + integration).

Feature: Offline checklist execution storage
  As an inspector using the Safety Codes Inspection PWA
  I need checklist answers saved on device
  So that work survives restarts and can sync when online

  @M5-S16
  Scenario: Checklist execution storage acceptance criteria are covered by automated tests
    Given the offline checklist execution storage acceptance criteria are defined for M5-S16
    Then unit and integration tests should cover persistence, recovery, sync queue, conflict merge, and cleanup after sync
