@m10-s4 @database
Feature: Report database model (M10-S4)
  As the reporting subsystem
  I want report rows tied to inspections
  So that PDF metadata and distribution can be audited

  Scenario: Persist and load a report with inspection relation
    Given M10-S4 report test data is prepared
    When I save a report row for that inspection
    Then the report should include storage key and hash
    And the report should list under the inspection
