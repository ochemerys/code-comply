@M11-S11 @api @performance @database
Feature: Database query optimization
  As a platform engineer
  I want database queries indexed, batched, and cached
  So that API responses stay under 200ms p95

  Scenario: M11-S11 query optimization acceptance criteria are covered by automated tests
    Given the database query optimization acceptance criteria are defined for M11-S11
    Then unit and integration tests should cover M11-S11 indexes caching and N+1 elimination
