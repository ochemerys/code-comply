# M6-S4: Deficiency CRUD and Stop Work HTTP API

Feature: Deficiency API Routes
  As the inspection API
  I want deficiencies exposed over HTTP with Stop Work support
  So that clients can list, create, update, delete, and issue Stop Work orders

  Background:
    Given deficiency API route test data is prepared
    And I am logged in to the API as the deficiency route test inspector

  Scenario: List and create deficiencies
    When I request GET deficiency list for test inspection
    Then the deficiency HTTP response status should be 200
    When I request POST create deficiency for test inspection
    Then the deficiency HTTP response status should be 201
    And the API response should include deficiency id

  Scenario: Stop Work order via HTTP
    When I request POST create deficiency for stop work scenario
    And I request POST stop-work for created deficiency
    Then the deficiency HTTP response status should be 200
    And the Stop Work notification hook should have been invoked for deficiency API
