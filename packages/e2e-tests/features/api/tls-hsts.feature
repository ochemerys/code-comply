@M11-S2 @api @security @critical
Feature: TLS 1.2+ and HSTS headers (M11-S2)
  As a security engineer
  I want TLS enforcement and HSTS on API responses
  So that connections use modern TLS and browsers enforce HTTPS

  Scenario: HTTPS responses include Strict-Transport-Security
    When I request the API health endpoint over HTTPS
    Then the response should include the HSTS header
    And the HSTS header should include a one-year max-age

  Scenario: Plain HTTP is rejected when TLS enforcement is enabled
    Given TLS enforcement is enabled for the API
    When I request the API health endpoint over plain HTTP
    Then the response status should be 403
    And the response should indicate TLS is required

  Scenario: Node TLS server options require TLS 1.2 or higher
    Then the API TLS configuration should require TLS 1.2 minimum
