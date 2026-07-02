# M6-S1: Deficiency database schema (checklist link, due date, Stop Work / unsafe, VOC-ready status)

Feature: Deficiency Database Schema

  Background:
    Given the deficiency schema test database is prepared

  Scenario: Persist deficiency with checklist item and due date
    When I create a deficiency with checklist item "item-9.10.1" and due date "2026-09-01"
    Then the deficiency should have checklist item "item-9.10.1"
    And the deficiency due date should be "2026-09-01"

  Scenario: Default Stop Work and unsafe flags are false
    When I create a minimal deficiency for schema E2E
    Then the deficiency isStopWork should be false
    And the deficiency isUnsafe should be false

  Scenario: Stop Work and unsafe flags persist
    When I create a deficiency flagged Stop Work and unsafe
    Then the deficiency isStopWork should be true
    And the deficiency isUnsafe should be true
