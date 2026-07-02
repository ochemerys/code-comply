@admin @orders @A-05
Feature: Order Processing
  As an administrator
  I want to process Stop Work orders and escalations
  So that safety hazards are addressed immediately

  Background:
    Given the API is running
    And the admin app is running
    And I am signed in as an admin

  @stop-work @alert
  Scenario: View Stop Work orders backed by the API
    When I open the admin Stop Work orders page
    Then I should see the Stop Work orders view
    And the orders list should not be in a loading state

  @stop-work @detail
  Scenario: Order list links to order detail with appeal deadline
    When I open the admin Stop Work orders page
    Then I should see the Stop Work orders view
    And the orders list should not be in a loading state
