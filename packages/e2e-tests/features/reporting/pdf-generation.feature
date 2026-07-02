@m10-s17 @reporting @M10-S17
Feature: Reporting PDF generation and download
  As compliance staff
  I want end-to-end coverage of PDF report generation and download
  So that reporting workflows are validated in CI

  Background:
    Given the API is running
    And the admin app is running

  Scenario: Generate inspection PDF and obtain signed download URL
    Given M10-S17 reporting test data is prepared
    When an inspection report PDF is generated for M10-S17
    Then the M10-S17 report should be a valid PDF with stored metadata
    And a signed download URL should be available for the M10-S17 report

  Scenario: Admin downloads a generated report from the reports UI
    Given M10-S17 reporting test data is prepared
    When an inspection report PDF is generated for M10-S17
    And I am signed in as an admin
    When I open the admin reports page for the M10-S17 inspection
    And I download the M10-S17 report from report history
    Then the M10-S17 report download request should succeed

  Scenario: Admin searches compliance records by permit number
    Given M10-S17 compliance search test data is prepared
    And I am signed in as an admin
    When I open the admin compliance search page
    And I search compliance records by the M10-S17 permit number
    Then I should see M10-S17 compliance search results
