@M11-S6 @api @security @critical
Feature: API rate limiting (M11-S6)
  As a security engineer
  I want API rate limits enforced per IP and per user
  So that abuse and DDoS attacks are mitigated

  Scenario: Login attempts are blocked after exceeding the limit
    Given a login rate limit of 2 attempts per minute
    When I send 3 login requests from the same IP
    Then the third login response status should be 429
    And the rate limit response should indicate too many requests

  Scenario: API requests include rate limit headers when allowed
    Given an API rate limit of 5 requests per minute
    When I send an API request from a fresh IP
    Then the response should include rate limit headers
    And the remaining allowance should be less than the limit

  Scenario: Rate limits reset after the window expires
    Given a login rate limit of 1 attempt per 100 milliseconds
    When I exceed the login rate limit from the same IP
    And I wait for the rate limit window to expire
    Then the next login request should be allowed
