@admin-csp @security @NFR-A-01
Feature: Admin portal Content Security Policy
  As a security engineer
  I want an enforcing CSP on the admin SPA shell
  So that XSS cannot easily exfiltrate tokens from localStorage

  Background:
    Given the API is running
    And the admin app is running

  Scenario: Admin index includes enforcing CSP meta tag
    When I request the admin portal index document
    Then the admin index should include an enforcing Content-Security-Policy meta tag
    And the admin CSP should include default-src self
    And the admin CSP should include script-src self
    And the admin CSP should restrict style sources
    And the admin CSP should restrict image sources
    And the admin CSP should deny frame embedding via HTTP header policy
    And the admin CSP should deny object embeds
    And the admin CSP connect-src should include the configured API URL
