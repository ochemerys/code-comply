@inspector @permit-list
Feature: Permit List View
  As an inspector
  I want to see a list of permit cards with filter and sort
  So that I can browse cached permits and find the one I need

  Background:
    Given I am logged in as an inspector
    And I am on the permits page

  Scenario: View permit list section
    When I scroll to the permit list section
    Then I should see the permit list heading "Your permits"
    And I should see the status filter
    And I should see the sort by control

  Scenario: Empty state when no permits cached
    When I scroll to the permit list section
    Then I should see the empty state "No permits to show"
    And I should see a "Refresh" button

  Scenario: List displays permit cards when cache has permits
    Given there are cached permits in the permit list
    When I scroll to the permit list section
    Then I should see at least one permit card
    And each permit card should show permit number and address
