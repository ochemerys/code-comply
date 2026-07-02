# M5-S5: Checklist & codes HTTP routes (Hono controllers)

Feature: Checklist and Codes API Routes
  As the inspection API
  I want checklist templates, executions, and code library exposed over HTTP
  So that inspector clients can run checklists and resolve code references

  Background:
    Given checklist API route test data is prepared
    And I am logged in to the API as the test inspector

  Scenario: List and load checklist templates
    When I request GET "/api/checklists/templates?discipline=Building"
    Then the API response status should be 200
    And the API response JSON should include template id from test data

  Scenario: Start execution and update a response
    When I request POST checklist execution for test data
    Then the API response status should be 201
    When I request PATCH test execution responses with PASS for the first item
    Then the API response status should be 200
    And the API response should have numeric progress 100

  Scenario: Search and resolve codes
    When I request GET "/api/codes?q=Fire"
    Then the API response status should be 200
    When I request GET "/api/codes/NBC/9.23.1"
    Then the API response status should be 200
    And the API response should have property "section" with value "9.23.1"

  Scenario: Reject codes search without query parameters
    When I request GET "/api/codes"
    Then the API response status should be 400
