@admin-auth-access
Feature: Admin portal authentication messaging
  As a user
  I want clear feedback when I cannot access the admin portal
  So that I understand why sign-in failed

  Background:
    Given the API is running
    And the admin app is running

  Scenario: Access denied reason is visible on the login page
    When I open the admin login page with access denied reason
    Then I should see the admin access denied notice
