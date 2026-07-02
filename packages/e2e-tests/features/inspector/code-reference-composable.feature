# M5-S7: useCodeReference composable — documented acceptance for E2E / BDD alignment
# Executable coverage: @codecomply/inspector vitest (unit + integration).

Feature: Code reference composable behavior
  As an inspector using the Safety Codes Inspection PWA
  I need searchable, selectable code references with offline cache
  So that I can cite violations accurately in the field

  @M5-S7
  Scenario: Code reference composable contract is covered by automated tests
    Given the code reference composable acceptance criteria are defined for M5-S7
    Then unit and integration tests should cover search, select, cache, and offline behavior
