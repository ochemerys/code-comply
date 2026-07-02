# M7-S18 — End-to-end evidence workflows (camera mock, mobile viewport, offline).
@M7-S18
Feature: Evidence photo capture and related field workflows
  As an inspector documenting evidence in the Safety Codes Inspection PWA
  I need reliable browser tests for capture, voice notes, upload readiness, and offline capture
  So that regressions in the evidence workflow are caught in CI

  Background:
    Given evidence E2E media mocks are installed
    And I am logged in as an inspector

  Scenario: User captures a checklist evidence photo with a mocked camera on mobile
    Given I have opened the mobile checklist execution page for inspection "m5s18" and execution "exec-m7s18-capture"
    When I mark each checklist item as Pass using the item buttons
    And I mark checklist item "item-1" as Fail choosing the first code search hit for "Fire"
    And I capture and accept a photo from the gallery on checklist item "item-1"
    Then checklist item "item-1" photo gallery should show at least one thumbnail

  Scenario: User dictates a deficiency description with mocked speech recognition
    Given I open the create deficiency form for inspection "m5s18"
    When I dictate notes using the voice input control
    Then the deficiency description should include the dictated phrase

  Scenario: Captured evidence is stored on device for checklist item (upload queue readiness)
    Given I have opened the mobile checklist execution page for inspection "m5s18" and execution "exec-m7s18-upload"
    When I mark each checklist item as Pass using the item buttons
    And I mark checklist item "item-1" as Fail choosing the first code search hit for "Fire"
    And I capture and accept a photo from the gallery on checklist item "item-1"
    Then captured evidence should appear in the checklist gallery for item "item-1"

  Scenario: User captures a photo while offline on mobile
    Given I have opened the mobile checklist execution page for inspection "m5s18" and execution "exec-m7s18-offline"
    When I mark each checklist item as Pass using the item buttons
    And I mark checklist item "item-1" as Fail choosing the first code search hit for "Fire"
    And the inspector browser goes offline
    And I capture and accept a photo from the gallery on checklist item "item-1"
    Then checklist item "item-1" photo gallery should show at least one thumbnail
    And the checklist footer should indicate offline saved state

  Scenario: Mandatory photo validation blocks complete until evidence exists
    Given I have opened the mobile checklist execution page for inspection "m5s18" and execution "exec-m7s18-mandatory"
    When I mark each checklist item as Pass using the item buttons
    And I mark checklist item "item-1" as Fail choosing the first code search hit for "Fire"
    Then the complete inspection button should be disabled
    When I capture and accept a photo from the gallery on checklist item "item-1"
    Then the complete inspection button should be enabled
    And the mandatory photo banner should not be visible
