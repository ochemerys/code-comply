@admin @compliance @foip-search @M10-S16
Feature: Admin compliance search
  As an administrator
  I want FOIP-compliant advanced search
  So that I can respond to compliance and information requests

  Background:
    Given the API is running
    And the admin app is running

  Scenario: Unauthenticated visitors are prompted to sign in on compliance search
    When I open the admin compliance search page
    Then I should see the admin sign in form
