@M11-S7 @api @security @critical
Feature: Security audit and headers (M11-S7)
  As a security engineer
  I want OWASP controls verified and security headers enforced
  So that the API passes production security audit

  Scenario: API responses include required security headers
    When I request the API health endpoint for security audit
    Then the response should include X-Frame-Options DENY
    And the response should include X-Content-Type-Options nosniff
    And the response should include Referrer-Policy no-referrer

  Scenario: OWASP Top 10 static audit passes
    When I run the OWASP Top 10 security audit
    Then all OWASP audit checks should pass

  Scenario: Dependency audit passes with no critical vulnerabilities
    Given a clean dependency audit result
    When I run the dependency vulnerability scan
    Then the dependency audit should pass
