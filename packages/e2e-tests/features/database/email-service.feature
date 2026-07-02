@m10-s11 @database
Feature: Email service (M10-S11)
  As compliance staff
  I want templated email delivery with attachments and tracking
  So that reports and notices can be distributed reliably

  Scenario: Send templated email with attachment and track delivery
    Given M10-S11 email service test harness is ready
    When an inspection report email is sent with a PDF attachment
    Then delivery status should be available for that message
