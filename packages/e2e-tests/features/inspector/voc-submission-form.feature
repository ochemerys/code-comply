# M10-S13: VoC submission form — BDD alignment with automated coverage
# Executable coverage: @codecomply/inspector vitest (unit + integration).

Feature: VoC submission form
  As an inspector resolving a deficiency
  I need a validated VoC form reachable from the deficiency detail
  So that compliance verification can be recorded offline or online

  @M10-S13
  Scenario: VoC form acceptance criteria are documented and covered by tests
    Given the VoC submission form acceptance criteria are defined for M10-S13
    Then unit and integration tests should cover VoC fields, validation, method select, submit, and offline queue
