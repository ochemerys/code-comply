@m10-s17 @reporting @voc @M10-S17
Feature: VoC submission and admin review workflow
  As an inspector and administrator
  I want end-to-end coverage of VoC submission and review
  So that deficiency resolution workflows are validated in CI

  Background:
    Given the API is running
    And the admin app is running
    And the inspector app is running

  Scenario: Inspector submits VoC and admin accepts it
    Given M10-S17 VoC workflow test data is prepared
    And I am logged in as an inspector
    When I submit VoC for the M10-S17 deficiency via the inspector UI
    Then the M10-S17 deficiency should show VoC submitted status
    When I am signed in as an admin
    And I open the admin VoC review page
    And I accept the M10-S17 pending VoC submission
    Then the M10-S17 deficiency should be closed after admin VoC acceptance
