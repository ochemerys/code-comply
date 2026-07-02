@admin @checklist @A-03
Feature: Checklist & Code Configuration
  As an administrator
  I want to manage checklist templates and code libraries
  So that inspectors have up-to-date inspection criteria

  Background:
    Given the API is running
    And the admin app is running
    And I am signed in as an admin

  @template-list
  Scenario: View checklist template list backed by the API
    When I open the admin checklist templates page
    Then I should see the checklist templates view
    And the checklist templates list should not be in a loading state

  @code-library
  Scenario: View code library backed by the API
    When I open the admin code library page
    Then I should see the code library view
    And the code library should not be in a loading state
