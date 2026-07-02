# M6-S3: DeficiencyService — CRUD, deduplication, ETag, Stop Work notification hook

Feature: Deficiency Service Domain
  As the inspection API
  I want deficiency business rules enforced in a domain service
  So that inspectors get consistent offline deduplication, concurrency, and Stop Work handling

  Background:
    Given deficiency service E2E data is prepared

  Scenario: Create deduplicates by clientId
    When I create the same deficiency twice via DeficiencyService
    Then only one deficiency row should exist for that clientId

  Scenario: Stop Work order triggers notification hook
    When I issue a Stop Work order via DeficiencyService
    Then the deficiency should be flagged Stop Work
    And the Stop Work notification hook should have been invoked
