@M11-S5 @api @security @critical
Feature: Input sanitization (M11-S5)
  As a security engineer
  I want all API user inputs sanitized
  So that injection and XSS attacks are prevented

  Scenario: XSS payloads are stripped from text fields
    Given a JSON payload with an HTML script injection in description
    When the payload is sanitized by the input sanitization library
    Then the sanitized description should not contain script tags
    And the sanitized description should preserve safe text content

  Scenario: SQL injection patterns are neutralized in text fields
    Given a JSON payload with a SQL injection attempt in description
    When the payload is sanitized by the input sanitization library
    Then the sanitized description should not contain SQL metacharacters
    And the sanitized description should contain the safe wiring issue text

  Scenario: Path traversal sequences are removed from file names
    Given a file name containing path traversal sequences
    When the file name is sanitized by the input sanitization library
    Then the sanitized file name should not contain parent directory references
    And the sanitized file name should retain the base file name
