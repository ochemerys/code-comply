@permits @permit-search
Feature: Permit Search
  As an inspector
  I want to search for permits by number or address
  So that I can quickly find specific inspection sites

  Background:
    Given I am logged in as an inspector
    And I am on the permits page

  Scenario: Search by permit number - exact match
    Given there are cached permits in the database
    When I enter "P-2024-001" in the search field
    Then I should see 1 permit result
    And the result should be permit "P-2024-001"

  Scenario: Search by permit number - partial match
    Given there are cached permits in the database
    When I enter "2024-00" in the search field
    Then I should see multiple permit results
    And all results should contain "2024-00" in the permit number

  Scenario: Search by address - full address
    Given there are cached permits in the database
    When I enter "123 Main Street" in the search field
    Then I should see permit results matching that address
    And each result should display the full address

  Scenario: Search by address - partial address
    Given there are cached permits in the database
    When I enter "Main" in the search field
    Then I should see all permits with "Main" in the address
    And the results should be sorted by relevance

  Scenario: Search by address - city name
    Given there are cached permits in the database
    When I enter "Edmonton" in the search field
    Then I should see all permits in Edmonton
    And each result should show the city name

  Scenario: Case-insensitive search
    Given there are cached permits in the database
    When I enter "main street" in the search field
    Then I should see the same results as "Main Street"
    And the search should be case-insensitive

  Scenario: No results found
    Given there are cached permits in the database
    When I enter "NONEXISTENT-PERMIT" in the search field
    Then I should see "No matches for"
    And I should see a suggestion to try a different search term

  Scenario: Clear search results
    Given I have performed a search with results
    When I click the clear search button
    Then the search field should be empty
    And I should see the default permit list view

  Scenario: Search with filters
    Given there are cached permits in the database
    When I enter "Main" in the search field
    And I select "ACTIVE" status filter
    Then I should only see active permits with "Main" in the address

  Scenario: Real-time search updates
    Given there are cached permits in the database
    When I start typing "P-2024"
    Then I should see results update as I type
    And the results should filter with each keystroke

  Scenario: Search offline with cached data
    Given there are cached permits in the database
    And I am offline
    When I enter "P-2024-001" in the search field
    Then I should see results from the local cache

  Scenario: Search performance
    Given there are 100 cached permits in the database
    When I enter a search term
    Then the results should appear within 500ms
    And the search should not block the UI

  Scenario: Select permit from search results
    Given I have performed a search with results
    When I click on a permit from the search results
    Then I should be navigated to the permit detail page
    And I should see the full permit information
