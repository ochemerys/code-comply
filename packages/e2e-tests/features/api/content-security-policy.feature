@M11-S1 @api @security @critical
Feature: Content Security Policy headers (M11-S1)
  As a security engineer
  I want CSP headers on API responses
  So that XSS and clickjacking attacks are mitigated

  Scenario: API responses include restrictive CSP headers
    When I request the API health endpoint
    Then the response should include a Content Security Policy header
    And the CSP should restrict script sources to self
    And the CSP should restrict style sources
    And the CSP should restrict image sources
    And the CSP should deny frame embedding

  Scenario: CSP supports report-only mode for testing
    Given CSP report-only mode is enabled for the API
    When I request the API health endpoint
    Then the response should include a Content-Security-Policy-Report-Only header
    And the response should not include an enforcing Content-Security-Policy header
