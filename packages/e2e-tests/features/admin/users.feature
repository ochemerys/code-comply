@m9-s15 @admin-portal-e2e
Feature: Admin portal user management journeys
  As an administrator
  I want to sign in and manage users
  So that registrations and certifications stay accurate

  Background:
    Given the API is running
    And the admin app is running

  Scenario: Admin signs in and reaches the dashboard
    Given I am signed in as an admin
    Then I should see the admin dashboard

  Scenario: Admin views the user registry
    Given I am signed in as an admin
    When I open the admin users page
    Then I should see the admin users registry shell

  Scenario: Owner account cannot activate an admin portal session
    When I attempt to sign in to the admin portal using owner credentials
    Then I should see the admin portal login denied message

  Scenario: Administrator updates certifications for the seeded inspector
    Given I am signed in as an admin
    When I open the user detail page for the seeded inspector
    Then I should see the certifications editor
    When I persist certifications from the user detail page
    Then there should be no error on the user detail page

  Scenario: Administrator signs out
    Given I am signed in as an admin
    When I sign out from the admin portal using the header menu
    Then I should see the admin sign in form
