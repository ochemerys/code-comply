# M6-S12: Severity selector — BDD alignment with automated coverage
# Executable coverage: @codecomply/inspector vitest (unit + integration).

Feature: Severity selector
  As an inspector recording deficiency severity in the field
  I need clear color-coded severity choices on a touch-friendly control
  So that Minor, Major, and Critical are chosen accurately and accessibly

  @M6-S12
  Scenario: Severity selector acceptance criteria are documented and covered by tests
    Given the severity selector acceptance criteria are defined for M6-S12
    Then unit and integration tests should cover options, selection, visual cues, and accessibility
