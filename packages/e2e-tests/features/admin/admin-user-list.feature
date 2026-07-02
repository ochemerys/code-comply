@admin-user-list
Feature: Admin user list page
  As an administrator
  I want the users route to exist behind authentication
  So that the registry is not exposed anonymously

  Background:
    Given the API is running
    And the admin app is running

  Scenario: Unauthenticated visitors are prompted to sign in on the users route
    When I open the admin users page
    Then I should see the admin sign in form
