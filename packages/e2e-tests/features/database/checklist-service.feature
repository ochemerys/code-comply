# M5-S3: ChecklistService domain logic (template, execution, responses, progress)

Feature: Checklist Service Domain
  As the inspection API
  I want checklist business rules enforced in a domain service
  So that executions stay consistent with templates and code references

  Background:
    Given checklist service E2E data is prepared

  Scenario: Get template by id
    When I load the checklist template by id via ChecklistService
    Then the template should have the expected version hash

  Scenario: Start execution pins version hash
    When I start a checklist execution for the test inspection and template
    Then the execution version hash should match the template

  Scenario: FAIL requires code reference
    Given a checklist execution exists for the test inspection
    When I attempt to record FAIL without code reference via ChecklistService
    Then ChecklistService should reject the update

  Scenario: Progress reflects answered items
    Given a checklist execution exists for the test inspection
    When I pass the first checklist item via ChecklistService
    Then checklist progress should be 50 percent
