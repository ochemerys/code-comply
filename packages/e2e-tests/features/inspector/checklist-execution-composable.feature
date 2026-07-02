# M5-S6: useChecklist composable — documented acceptance for E2E / BDD alignment
# Full browser automation hooks in when Inspector checklist UI lands (M5-S7+).

Feature: Checklist execution composable behavior
  As an inspector using the Safety Codes Inspection PWA
  I need checklist state, progress, and scroll helpers
  So that I can complete inspections efficiently in the field

  @M5-S6
  Scenario: Checklist composable contract is covered by automated tests
    Given the checklist composable acceptance criteria are defined for M5-S6
    Then unit and integration tests should cover execution state and scroll helpers
