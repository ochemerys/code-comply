# M3-S2: Sensitive IndexedDB fields encrypted at rest (browser E2E)
# Complements @codecomply/inspector vitest — encryption.spec.ts, encryption-middleware.spec.ts

@M3-S2 @inspector @security @critical
Feature: IndexedDB encryption at rest
  As a Safety Codes Officer using the Inspector PWA
  I need sensitive data encrypted in IndexedDB
  So that inspection notes and deficiency descriptions are protected at rest

  Background:
    Given I am logged in as an inspector
    And the inspector encryption session is ready

  Scenario: Inspection notes are encrypted before storage
    When I store an inspection note "Confidential site assessment details" locally
    Then the raw IndexedDB notes field must not contain "Confidential site assessment details"
    And the raw IndexedDB notes field should be encrypted
    And reading the inspection through the app returns notes "Confidential site assessment details"

  Scenario: Deficiency description is encrypted before storage
    When I store a deficiency description "Missing fire extinguisher in hallway near room 101" locally
    Then the raw IndexedDB description field must not contain "Missing fire extinguisher"
    And the raw IndexedDB description field should be encrypted
    And reading the deficiency through the app returns description "Missing fire extinguisher in hallway near room 101"

  Scenario: Non-sensitive fields remain plaintext at rest
    When I store an inspection with status "IN_PROGRESS" and notes "Secret notes" locally
    Then the raw IndexedDB status field should equal "IN_PROGRESS"
    And the raw IndexedDB notes field should be encrypted
