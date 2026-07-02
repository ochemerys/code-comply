@admin-inspection-monitor
Feature: Admin inspection monitor route
  As an administrator
  I want the inspection monitor route to exist behind authentication
  So that real-time inspection visibility is not exposed anonymously

  Background:
    Given the API is running
    And the admin app is running

  Scenario: Unauthenticated visitors are prompted to sign in on the inspection monitor route
    When I open the admin inspection monitor page
    Then I should see the admin sign in form

