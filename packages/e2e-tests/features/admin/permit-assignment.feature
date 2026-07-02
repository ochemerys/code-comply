@admin @permit-management @A-02
Feature: Permit & Assignment Management
  As an administrator
  I want to manage permits and assign inspections to inspectors
  So that work is properly distributed and tracked

  Background:
    Given the API is running
    And the admin app is running
    And I am signed in as an admin

  @permit-sync
  Scenario: Sync active permits and view permit list
    When I open the admin permits page
    Then I should see the permit management view
    When I click sync permits on the admin permits page
    Then I should see a permit sync summary on the admin permits page

  @assignment-grid
  Scenario: View assignment grid backed by the API
    When I open the admin assignment grid page
    Then I should see the admin assignment grid shell
    And the assignment grid should not be in a loading state

  @bulk-assignment
  Scenario: View bulk assignment planner backed by the API
    When I open the admin bulk assignment page
    Then I should see the bulk assignment planner shell
    And the bulk assignment should not be in a loading state
