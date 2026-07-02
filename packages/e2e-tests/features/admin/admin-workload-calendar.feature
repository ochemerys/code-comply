@admin-workload-calendar
Feature: Admin workload calendar route
  As an administrator
  I want the workload calendar route to exist behind authentication
  So that inspector workload planning is not exposed anonymously

  Background:
    Given the API is running
    And the admin app is running

  Scenario: Unauthenticated visitors are prompted to sign in on the workload calendar route
    When I open the admin workload calendar page
    Then I should see the admin sign in form
