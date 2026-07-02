# M6-S6: useDeficiencies composable — BDD alignment with automated coverage
# Executable coverage: @codecomply/inspector vitest (unit + integration).

Feature: Deficiencies list composable behavior
  As an inspector using the Safety Codes Inspection PWA
  I need a reactive deficiency list with offline cache and filters
  So that open and critical counts stay accurate in the field

  @M6-S6
  Scenario: Deficiencies list composable acceptance criteria are documented and covered by tests
    Given the deficiencies list composable acceptance criteria are defined for M6-S6
    Then unit and integration tests should cover online fetch, offline cache, merge, and filters
