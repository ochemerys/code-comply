# M6-S8: Deficiency list view — BDD alignment with automated coverage
# Executable coverage: @codecomply/inspector vitest (unit + integration).

Feature: Deficiency list view
  As an inspector reviewing recorded deficiencies
  I need a filterable list with severity and status context
  So that I can prioritize follow-up during the inspection

  @M6-S8
  Scenario: Deficiency list acceptance criteria are documented and covered by tests
    Given the deficiency list view acceptance criteria are defined for M6-S8
    Then unit and integration tests should cover cards, badges, filters, and empty state
