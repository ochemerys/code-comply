@m10-s5 @database
Feature: Verification of Compliance model (M10-S5)
  As compliance staff
  I want VoC records tied to deficiencies
  So that submissions and reviews are auditable

  Scenario: Create and review a VoC row
    Given M10-S5 VoC test data is prepared
    When a VerificationOfCompliance record is created for the deficiency
    Then the VoC should link to the deficiency with expected fields
    When the VoC is accepted by a reviewer
    Then the VoC status should be ACCEPTED with reviewer set
