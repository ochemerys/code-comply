# M5-S14: Code reference selector modal — documented acceptance for E2E / BDD alignment
# Executable coverage: @codecomply/inspector vitest (unit + integration).

Feature: Code reference selector modal
  As an inspector using the Safety Codes Inspection PWA
  I need a modal to search and pick code references when marking checklist items as failed
  So that failures are cited accurately, including offline from cached codes

  @M5-S14
  Scenario: Code reference modal acceptance criteria are covered by automated tests
    Given the code reference modal acceptance criteria are defined for M5-S14
    Then unit and integration tests should cover modal open on fail, debounced search, recent codes, selection, and offline cache
