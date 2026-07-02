@M11-S8 @inspector @performance
Feature: Inspector lazy-loaded routes (M11-S8)
  As a safety codes officer
  I want routes to load on demand
  So that the initial app bundle stays small

  Background:
    Given the API is running
    And the inspector app is running

  Scenario: Public user manual route loads via lazy route
    When I open the inspector user manual page
    Then I should see the inspector user manual content

  Scenario: Login route loads without requiring authentication
    When I open the inspector login page
    Then I should see the inspector sign in form
