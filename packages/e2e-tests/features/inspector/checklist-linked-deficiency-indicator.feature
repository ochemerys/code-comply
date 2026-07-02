# M6-S14: Linked deficiencies on checklist — BDD alignment with automated coverage
# Executable coverage: @codecomply/inspector vitest (unit + integration).

Feature: Checklist linked deficiency indicator
  As an inspector reviewing failed checklist items
  I need to see how many deficiencies are linked to each failure
  So that I can open the deficiency list filtered to that item

  @M6-S14
  Scenario: M6-S14 acceptance criteria are documented and covered by automated tests
    Given the checklist linked deficiency indicator acceptance criteria are defined for M6-S14
    Then unit and integration tests should cover indicator visibility, counts, navigation, and list filtering
