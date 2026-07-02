@m10-s1 @database
Feature: PDF generation library (PDFKit)
  As the reporting subsystem
  I want inspection-style PDFs generated in Node
  So that reports work in Docker without a browser

  Scenario: Generate inspection PDF bytes with optional embedded image
    When PDFKit generates an inspection PDF from library code
    Then the PDF buffer should look valid
