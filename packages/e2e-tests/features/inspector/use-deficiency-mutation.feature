# M6-S5: useDeficiencyMutation composable — BDD alignment with automated coverage
# Executable coverage: @codecomply/inspector vitest (unit + integration).

Feature: Deficiency mutation composable behavior
  As an inspector using the Safety Codes Inspection PWA
  I need reliable deficiency create, update, and delete with offline queueing
  So that findings stay accurate in the field with or without connectivity

  @M6-S5
  Scenario: Deficiency mutation composable acceptance criteria are documented and covered by tests
    Given the deficiency mutation composable acceptance criteria are defined for M6-S5
    Then unit and integration tests should cover online API, offline queue, and rollback behavior
