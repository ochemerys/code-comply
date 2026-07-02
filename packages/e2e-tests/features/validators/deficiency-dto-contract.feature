# M6-S2: Deficiency Zod DTOs — contract checks via @codecomply/validators

Feature: Deficiency DTO contract

  @validators
  Scenario: Valid create deficiency payload validates
    Given a valid create deficiency JSON fixture
    When I validate the fixture with CreateDeficiencyDTOSchema
    Then the deficiency DTO validation should succeed

  @validators
  Scenario: Create payload with short description is invalid
    Given a create deficiency JSON with description shorter than 10 characters
    When I validate the fixture with CreateDeficiencyDTOSchema
    Then the deficiency DTO validation should fail

  @validators
  Scenario: Update payload must not include clientId
    Given an update deficiency JSON that includes clientId
    When I validate the fixture with UpdateDeficiencyDTOSchema
    Then the deficiency DTO validation should fail
