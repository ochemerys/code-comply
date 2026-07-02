@admin-assignment-grid
Feature: Admin assignment grid route
  As an administrator
  I want the assignment grid route to exist behind authentication
  So that assignment scheduling is not exposed anonymously

  Background:
    Given the API is running
    And the admin app is running

  Scenario: Unauthenticated visitors are prompted to sign in on the assignment grid route
    When I open the admin assignment grid page
    Then I should see the admin sign in form

