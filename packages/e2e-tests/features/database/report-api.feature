@m10-s9 @database
Feature: Report API persistence (M10-S9)
  As compliance staff
  I want generated reports stored with signed download URLs
  So that PDFs can be retrieved from object storage

  Scenario: Generate, list, and sign report download URL
    Given M10-S9 report API test data is prepared
    When an inspection report is generated and stored
    Then the report should appear in the inspection report list
    And a signed download URL should be available for that report
