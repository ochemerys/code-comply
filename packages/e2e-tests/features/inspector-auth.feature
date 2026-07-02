@inspector-auth-only
Feature: Inspector Authentication
  As an inspector
  I want to log in to the application
  So that I can access my inspections

  Background:
    Given the API is running
    And the inspector app is running

  @inspector-auth-only
  Scenario: Successful login with valid credentials
    Given I am on the login page
    When I enter email "test-inspector@example.com"
    And I enter password "Test123!"
    And I click the sign in button
    Then I should be redirected to the home page
    And I should see my name in the header

  @inspector-auth-only
  Scenario: Failed login with invalid credentials
    Given I am on the login page
    When I enter email "test-inspector@example.com"
    And I enter password "wrongpassword"
    And I click the sign in button
    Then I should see an error message "Invalid email or password"
    And I should remain on the login page

  @inspector-auth-only
  Scenario: Redirect to login when accessing protected route
    Given I am not authenticated
    When I navigate to "/inspections"
    Then I should be redirected to the login page
    And the URL should contain "redirect=/inspections"

  @inspector-auth-only
  Scenario: Redirect to intended route after login
    Given I am not authenticated
    And I navigate to "/inspections"
    And I am redirected to the login page
    When I enter email "test-inspector@example.com"
    And I enter password "Test123!"
    And I click the sign in button
    Then I should be redirected to "/inspections"

  @inspector-auth-only
  Scenario: View user profile
    Given I am logged in as an inspector
    When I click on my user avatar
    And I click "View Profile"
    Then I should see my profile page
    And I should see my email address
    And I should see my role

  @inspector-auth-only
  Scenario: Logout successfully
    Given I am logged in as an inspector
    When I click on my user avatar
    And I click "Sign Out"
    Then I should be redirected to the login page
    And I should not be authenticated

  @inspector-auth-only
  Scenario: Session persists across page reloads
    Given I am logged in as an inspector
    When I reload the page
    Then I should still be authenticated
    And I should see my name in the header

  @inspector-auth-only
  Scenario: Offline login is blocked
    Given I am on the login page
    And I am offline
    Then the sign in button should be disabled
