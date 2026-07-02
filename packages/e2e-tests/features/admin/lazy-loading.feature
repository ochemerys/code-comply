@M11-S8 @admin @performance
Feature: Admin lazy-loaded routes (M11-S8)
  As an administrator
  I want routes and heavy views to load on demand
  So that the initial admin bundle stays small

  Background:
    Given the API is running
    And the admin app is running

  Scenario: Login route loads via lazy route
    When I open the admin portal login page
    Then I should see the admin sign in form

  Scenario: Workload calendar route is reachable behind authentication
    When I open the admin workload calendar page
    Then I should see the admin sign in form
