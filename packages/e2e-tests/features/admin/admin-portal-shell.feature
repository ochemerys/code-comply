@admin-portal-shell
Feature: Admin portal application shell
  As an administrator
  I want the admin portal to load with routing and layout
  So that I can sign in and use the dashboard

  Background:
    Given the API is running
    And the admin app is running

  Scenario: Admin login page is reachable
    When I open the admin portal login page
    Then I should see the admin sign in form
