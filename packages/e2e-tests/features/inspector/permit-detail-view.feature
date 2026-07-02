@inspector @permit-detail
Feature: Permit Detail View
  As an inspector
  I want to view full permit details and scheduled inspections
  So that I can start an inspection or get directions

  Background:
    Given I am logged in as an inspector
    And I am on the permits page

  Scenario: Navigate to permit detail from list
    Given there are cached permits in the permit list
    When I click the first permit card
    Then I should be on the permit detail page
    And I should see the permit detail heading
    And I should see permit information section
    And I should see scheduled inspections section
    And I should see a "Start Inspection" button

  Scenario: Permit detail shows back navigation
    Given there are cached permits in the permit list
    When I click the first permit card
    Then I should see a "Back to Permits" control
    When I click the back to permits control
    Then I should be on the permits list page

  Scenario: Get Directions button when permit has coordinates
    Given there are cached permits in the permit list with coordinates
    When I click the first permit card
    Then I should see an enabled "Get Directions" button
