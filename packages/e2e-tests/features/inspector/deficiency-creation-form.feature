# M6-S7: Deficiency creation form — BDD alignment with automated coverage
# Executable coverage: @codecomply/inspector vitest (unit + integration).

Feature: Deficiency creation form
  As an inspector recording safety deficiencies in the field
  I need a validated form with severity and optional code reference
  So that deficiencies are complete before sync or submission

  @M6-S7
  Scenario: Deficiency form acceptance criteria are documented and covered by tests
    Given the deficiency creation form acceptance criteria are defined for M6-S7
    Then unit and integration tests should cover fields, validation, code reference, and submit flow
