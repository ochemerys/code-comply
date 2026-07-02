# M5-S2: Shared Zod checklist DTOs — contract checks via @codecomply/validators

Feature: Checklist DTO contract

  @validators
  Scenario: Valid checklist template payload validates
    Given a valid checklist template JSON fixture
    When I validate the fixture with ChecklistTemplateDTOSchema
    Then the validation result should be successful

  @validators
  Scenario: FAIL response without code reference is invalid
    Given a checklist response JSON with result FAIL and no codeReference
    When I validate the fixture with ChecklistResponseDTOSchema
    Then the validation result should be unsuccessful
