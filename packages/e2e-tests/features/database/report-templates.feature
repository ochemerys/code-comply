@m10-s3 @database
Feature: Report PDF templates
  As the reporting engine
  I want reusable PDF templates
  So that inspection, deficiency, and no-entry documents stay consistent

  Scenario: Render core report templates in Node
    When report PDF templates are rendered for M10-S3
    Then each output should be a valid PDF
