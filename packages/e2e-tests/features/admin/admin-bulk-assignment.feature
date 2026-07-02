@admin-bulk-assignment
Feature: Admin bulk assignment route
  As an administrator
  I want the bulk assignment route to exist behind authentication
  So that bulk inspection assignment is not exposed anonymously

  Background:
    Given the API is running
    And the admin app is running

  Scenario: Unauthenticated visitors are prompted to sign in on the bulk assignment route
    When I open the admin bulk assignment page
    Then I should see the admin sign in form
