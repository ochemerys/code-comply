# M7-S16: Mandatory photo validation for failed checklist items — BDD alignment with automated coverage
# Executable coverage: @codecomply/inspector vitest (unit + integration).

Feature: Mandatory checklist photo validation
  As an inspector completing a checklist with photo-required failed items
  I need clear validation, an in-context photo gallery, and a blocked submit until evidence exists
  So that required inspection photos cannot be skipped

  @M7-S16
  Scenario: Mandatory photo validation acceptance criteria are documented and covered by tests
    Given the mandatory checklist photo validation acceptance criteria are defined for M7-S16
    Then unit and integration tests should cover FAIL plus requiresPhoto rules, IndexedDB counts, gallery scoping, and completion gating
