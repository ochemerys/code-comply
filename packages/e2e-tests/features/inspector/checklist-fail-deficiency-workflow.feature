# M6-S13: Linked deficiency recording from checklist FAIL — BDD alignment with automated coverage
# Executable coverage: @codecomply/inspector vitest (unit + integration).

Feature: Checklist fail and deficiency recording
  As an inspector marking a checklist item as failed
  I need to choose a code reference first, then open the deficiency form when I am ready
  So that the checklist result and formal deficiency stay distinct and I am not forced through two modals at once

  @M6-S13
  Scenario: Checklist FAIL deficiency workflow acceptance criteria are documented and covered by tests
    Given the checklist fail deficiency workflow acceptance criteria are defined for M6-S13
    Then unit and integration tests should cover optional deficiency modal after Record deficiency, pre-filled code, checklist link, close, and re-open from failed item
