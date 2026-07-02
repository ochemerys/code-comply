@m10-s7 @database
Feature: Addendum database model (M10-S7)
  As compliance staff
  I want addendum rows tied to finalized inspections
  So that amendments preserve the original legal record

  Scenario: Persist addendum with inspection link and signature
    Given M10-S7 addendum test data is prepared
    When an addendum is created for the inspection
    Then the addendum should reference the inspection with reason and content
    And the addendum should store an optional signature and created timestamp
