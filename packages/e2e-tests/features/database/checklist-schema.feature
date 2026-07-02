# M5-S1: Checklist database schema (versioned templates, executions, code library)

Feature: Checklist Database Schema

  Background:
    Given the checklist database is clean

  Scenario: Create checklist template with version hash
    When I create a checklist template:
      | name        | Electrical rough-in     |
      | discipline  | Electrical              |
      | versionHash | sha256:e2e-template-001 |
      | items       | []                      |
    Then the checklist template should be persisted
    And the template versionHash should be unique in the database

  Scenario: Enforce unique versionHash on templates
    Given a checklist template exists with versionHash "sha256:collision"
    When I attempt another template with versionHash "sha256:collision"
    Then the checklist template create should fail with unique constraint

  Scenario: Code library unique code and section
    When I insert code library row with code "NBC" section "9.10.1" and title "Fire separation"
    And I insert code library row with code "NBC" section "9.10.2" and title "Another section"
    Then code library should have 2 rows for NBC
    When I attempt duplicate code library with code "NBC" and section "9.10.1"
    Then the code library create should fail with unique constraint

  Scenario: Checklist execution on inspection
    Given a permit and inspection exist for checklist E2E
    And a checklist template exists with versionHash "sha256:e2e-exec"
    When I create a checklist execution for that inspection
    Then the execution should reference the template versionHash
    And the execution should link to the inspection and template

  Scenario: Query templates by discipline and active flag
    Given an active Building template and inactive Plumbing template exist
    When I query active Building templates
    Then I should get only the Building active template
