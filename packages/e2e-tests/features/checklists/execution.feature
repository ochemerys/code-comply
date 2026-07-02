# M5-S18: End-to-end checklist execution workflow
# Runs against the Inspector PWA with a real browser (Playwright + Cucumber).

@M5-S18
Feature: Checklist execution workflow
  As an inspector using the Safety Codes Inspection PWA
  I want to run through the checklist execution flow in the browser
  So that Pass/Fail/N/A, code references, progress, filters, and offline execution are regression-tested

  Background:
    Given I am logged in as an inspector

  Scenario: User marks all items as PASS
    Given I have opened the checklist execution page for inspection "m5s18" and execution "exec-mark-each-pass"
    When I mark each checklist item as Pass using the item buttons
    Then the checklist progress percentage should be 100

  Scenario: User marks item as FAIL with code reference
    Given I have opened the checklist execution page for inspection "m5s18" and execution "exec-fail-code"
    When I mark checklist item "item-1" as Fail choosing the first code search hit for "Fire"
    Then checklist item "item-1" should show FAIL with a code reference

  Scenario: User uses Pass All feature
    Given I have opened the checklist execution page for inspection "m5s18" and execution "exec-pass-all"
    When I confirm Pass all on the checklist
    Then the checklist progress percentage should be 100

  Scenario: User filters to show failed only
    Given I have opened the checklist execution page for inspection "m5s18" and execution "exec-filter-failed"
    When I mark checklist item "item-2" as Fail choosing the first code search hit for "Fire"
    And I mark checklist item "item-1" as Pass using its Pass button
    And I set the checklist filter to failed only
    Then only failed checklist items are visible in the list
    And checklist item "item-2" should be visible
    And checklist item "item-1" should not be visible

  Scenario: User completes checklist offline
    Given I have opened the checklist execution page for inspection "m5s18" and execution "exec-offline"
    When the inspector browser goes offline
    And I confirm Pass all on the checklist
    Then the checklist footer should indicate offline saved state
