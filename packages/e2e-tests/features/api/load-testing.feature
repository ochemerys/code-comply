@M11-S13 @api @performance @load
Feature: API load testing (M11-S13)
  As a platform engineer
  I want the system validated under concurrent load
  So that sync, PDF, and API paths meet production targets

  Scenario: M11-S13 load testing acceptance criteria are covered by automated tests
    Given the load testing acceptance criteria are defined for M11-S13
    Then unit and integration tests should cover M11-S13 concurrent sync API and PDF load
