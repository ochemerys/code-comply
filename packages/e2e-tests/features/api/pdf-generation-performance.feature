@M11-S12 @api @performance @pdf
Feature: PDF generation performance
  As a platform engineer
  I want inspection PDFs to generate quickly with many photos
  So that inspectors receive reports without long waits

  Scenario: M11-S12 PDF generation acceptance criteria are covered by automated tests
    Given the PDF generation performance acceptance criteria are defined for M11-S12
    Then unit and integration tests should cover M11-S12 streaming resize workers and timeouts
