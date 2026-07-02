@m10-s6 @database
Feature: VoC domain service (M10-S6)
  As compliance staff
  I want VoC submission and review handled by a domain service
  So that deficiencies resolve through an auditable workflow

  Scenario: Submit, accept, and resolve deficiency
    Given M10-S6 VoC service test data is prepared
    When the inspector submits VoC for the deficiency
    Then the VoC should be pending for that deficiency
    When an admin accepts the VoC submission
    Then the deficiency should be closed after VoC acceptance
