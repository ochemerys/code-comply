# M6-S18: Stop Work order workflow — E2E from deficiency detail (mobile viewport).
@M6-S18
Feature: Stop Work order from deficiency detail
  As an inspector who finds a critical unsafe condition
  I need to issue a Stop Work order from the deficiency record
  So that the site is flagged immediately per safety workflow

  Background:
    Given the API is running
    And the inspector app is running
    And I am logged in as an inspector
    And M6-S18 deficiency E2E inspection is prepared for the seeded inspector

  @M6-S18 @mobile
  Scenario: Issue Stop Work from deficiency detail
    When I open the M6-S18 deficiency list
    And I start a new deficiency from the M6-S18 deficiency list
    And I submit a minimal M6-S18 deficiency with description "E2E stop work baseline description text for safety." and severity "MAJOR"
    And I open the first deficiency card from the M6-S18 list
    Then I should see the M6-S18 deficiency detail view
    When I request Stop Work from the M6-S18 deficiency detail view
    And I confirm the M6-S18 Stop Work dialog
    Then I should see M6-S18 Stop Work issued on deficiency detail

  @M6-S18 @mobile
  Scenario: Issue Stop Work while offline
    When I open the M6-S18 deficiency list
    And I start a new deficiency from the M6-S18 deficiency list
    And I submit a minimal M6-S18 deficiency with description "E2E offline stop work description text here." and severity "CRITICAL"
    And I open the first deficiency card from the M6-S18 list
    And the inspector browser goes offline
    When I request Stop Work from the M6-S18 deficiency detail view
    And I confirm the M6-S18 Stop Work dialog
    Then I should see M6-S18 Stop Work issued on deficiency detail
