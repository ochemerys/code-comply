@m9-s15 @admin-portal-e2e
Feature: Admin portal assignment and monitoring journeys
  As an administrator
  I want scheduling and workload views plus live inspection status
  So that workloads stay balanced and field progress is visible

  Background:
    Given the API is running
    And the admin app is running
    And I am signed in as an admin

  Scenario: Admin opens the assignment planning grid
    When I open the admin assignment grid page
    Then I should see the admin assignment grid shell

  Scenario: Admin opens the workload calendar
    When I open the admin workload calendar page
    Then I should see the workload calendar shell

  Scenario: Admin opens bulk inspection assignment
    When I open the admin bulk assignment page
    Then I should see the bulk assignment planner shell

  Scenario: Admin opens inspection monitoring with live refresh affordances
    When I open the admin inspection monitor page
    Then I should see the inspection monitor shell with last updated metadata
