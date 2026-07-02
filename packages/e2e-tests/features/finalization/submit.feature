@inspector @M8-S14
Feature: Inspection finalization end-to-end (M8-S14)
  As an inspector completing an inspection
  I want validation, outcome selection, signature capture, and offline queue behavior
  So that I can finalize confidently in the field (online or offline)

  Background:
    Given the API is running
    And the inspector app is running
    And I am logged in as an inspector
    And I have a locally cached inspection ready for finalization

  Scenario: Validation prevents incomplete submissions
    When I open the inspection review screen
    Then the submit inspection action should be disabled
    And I should see the finalization validation message "Outcome is required."
    And I should see the finalization validation message "Signature is required."

  Scenario: Inspector selects an outcome
    When I open the inspection review screen
    And I select the inspection outcome "ACCEPTABLE"
    Then the outcome option "ACCEPTABLE" should be selected

  Scenario: Inspector captures a signature
    When I open the inspection review screen
    And I draw a signature and accept it
    Then I should see the signature preview attached

  Scenario: Inspector finalizes successfully (queues submission)
    When I open the inspection review screen
    And I select the inspection outcome "ACCEPTABLE"
    And I draw a signature and accept it
    And I submit the inspection finalization confirmation
    Then I should see a submission success result

  Scenario: Inspection is read-only after sync
    Given the cached inspection is marked finalized and synced
    When I open the inspection review screen
    Then I should see the inspection read-only banner
    And the submit inspection action should be disabled

  Scenario: Inspector submits offline and syncs later
    When I open the inspection review screen
    And I select the inspection outcome "ACCEPTABLE"
    And I draw a signature and accept it
    And I simulate being offline
    Then I should see the inspection offline warning
    And I submit the inspection finalization confirmation
    Then I should see a submission success result
