@admin @reporting @A-04
Feature: Reporting & Distribution Engine
  As an administrator
  I want to generate and distribute inspection reports
  So that stakeholders receive official documentation

  Background:
    Given the API is running
    And the admin app is running
    And I am signed in as an admin

  @pdf-generation
  Scenario: Admin reports page loads with generator and history
    When I open the admin reports page
    Then I should see the report generation view
    And the report generator should be visible
