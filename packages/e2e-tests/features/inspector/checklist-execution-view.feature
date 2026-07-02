# M5-S8: Checklist execution view — documented acceptance for E2E / BDD alignment
# Executable UI coverage: @codecomply/inspector vitest (unit + integration).

Feature: Checklist execution view
  As an inspector using the Safety Codes Inspection PWA
  I need a checklist execution screen with progress, grouping, and offline-friendly save
  So that I can complete inspections efficiently in the field

  @M5-S8
  Scenario: Checklist execution view acceptance criteria are covered by automated tests
    Given the checklist execution view acceptance criteria are defined for M5-S8
    Then unit and integration tests should cover items, progress, grouping, scroll, and offline affordances
