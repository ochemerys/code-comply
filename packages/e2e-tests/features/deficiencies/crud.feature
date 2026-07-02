# M6-S18: Deficiency management E2E — CRUD, checklist deep-link, offline create (mobile viewport).
@M6-S18
Feature: Deficiency CRUD and checklist linking
  As an inspector recording deficiencies during an inspection
  I need to create, filter by checklist item, edit, delete, and save while offline
  So that findings stay accurate and traceable in the field

  Background:
    Given the API is running
    And the inspector app is running
    And I am logged in as an inspector
    And M6-S18 deficiency E2E inspection is prepared for the seeded inspector

  @M6-S18 @mobile
  Scenario: Create, edit, and delete a deficiency
    When I open the M6-S18 deficiency list
    And I start a new deficiency from the M6-S18 deficiency list
    And I submit a minimal M6-S18 deficiency with description "E2E CRUD baseline description text." and severity "MINOR"
    Then I should see the M6-S18 deficiency list with text "E2E CRUD baseline description text."
    When I open the first deficiency card from the M6-S18 list
    Then I should see the M6-S18 deficiency detail view
    When I open edit deficiency from the M6-S18 detail view
    And I change the M6-S18 deficiency description to "E2E CRUD updated description text for edit."
    And I save the M6-S18 edit deficiency modal
    Then I should see M6-S18 deficiency detail description "E2E CRUD updated description text for edit."
    When I request delete from the M6-S18 deficiency detail view
    And I confirm M6-S18 delete deficiency dialog
    Then I should see the M6-S18 deficiency list empty state

  @M6-S18 @mobile
  Scenario: Create deficiency from checklist item failure and code selection
    When I open the M6-S18 checklist execution page
    And I mark checklist item "item-1" as Fail choosing the first code search hit for "Fire"
    And I open the record deficiency form for checklist item "item-1"
    And I submit a minimal M6-S18 deficiency in the checklist fail modal with description "E2E checklist FAIL flow deficiency description text." and severity "MAJOR"
    When I open the M6-S18 deficiency list filtered by checklist item id "item-1"
    Then I should see the M6-S18 checklist filter banner
    And I should see the M6-S18 deficiency list with text "E2E checklist FAIL flow deficiency description text."

  @M6-S18 @mobile
  Scenario: Checklist item deep-link shows filtered list after save
    When I open new deficiency for M6-S18 inspection with checklist item id "item-2"
    And I submit a minimal M6-S18 deficiency with description "E2E checklist-linked deficiency description text." and severity "MAJOR"
    Then I should see the M6-S18 deficiency list with text "E2E checklist-linked deficiency description text."
    When I open the M6-S18 deficiency list filtered by checklist item id "item-2"
    Then I should see the M6-S18 checklist filter banner
    And I should see the M6-S18 deficiency list with text "E2E checklist-linked deficiency description text."
