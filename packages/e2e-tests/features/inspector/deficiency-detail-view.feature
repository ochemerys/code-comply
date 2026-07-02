# M6-S9: Deficiency detail view — BDD alignment with automated coverage
# Executable coverage: @codecomply/inspector vitest (unit + integration).

Feature: Deficiency detail view
  As an inspector reviewing a single deficiency
  I need the full record with edit, evidence, and lifecycle actions
  So that I can correct details and close items safely on site

  @M6-S9
  Scenario: Deficiency detail acceptance criteria are documented and covered by tests
    Given the deficiency detail view acceptance criteria are defined for M6-S9
    Then unit tests should cover DeficiencyDetails and form edit mode, and the deficiency list integration should retain navigation to detail

  @M6-S10
  Scenario: Edit deficiency modal acceptance criteria are documented and covered by tests
    Given the edit deficiency modal acceptance criteria are defined for M6-S10
    Then unit and integration tests should cover EditDeficiencyModal with seeded values and cancel or save flows

  @M6-S11
  Scenario: Delete deficiency dialog acceptance criteria are documented and covered by tests
    Given the delete deficiency dialog acceptance criteria are defined for M6-S11
    Then unit and integration tests should cover DeleteDeficiencyDialog with summary, confirm, cancel, loading, and error states

  @M6-S15
  Scenario: Stop Work order workflow acceptance criteria are documented and covered by tests
    Given the Stop Work order workflow acceptance criteria are defined for M6-S15
    Then unit and integration tests should cover Stop Work button, confirmation dialog, mutation queue, and edit-form lock when Stop Work is already issued
