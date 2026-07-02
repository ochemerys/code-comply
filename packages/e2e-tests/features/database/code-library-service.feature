# M5-S4: CodeLibraryService — search, getByCode, listByType

Feature: Code Library Service Domain
  As the inspection API
  I want to search and resolve safety code references from the code library
  So that inspectors can attach valid NBC / IFC / AEC / STANDATA citations

  Background:
    Given code library service E2E data is prepared

  Scenario: Search finds entries by text
    When I search the code library for "Fire"
    Then I should get at least one NBC result

  Scenario: Get by code and section
    When I resolve code "NBC" section "9.23.1" via CodeLibraryService
    Then the resolved title should be "Wood framing"

  Scenario: List by code type
    When I list code library entries for type "NBC"
    Then I should get multiple sections ordered by section
