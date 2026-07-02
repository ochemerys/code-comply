@inspector @M8-S6
Feature: Inspection review finalization (M8-S6)
  As an inspector completing an inspection
  I want GPS, timestamps, outcome, signature, and certification snapshot captured with an explicit confirmation
  So that finalization is deliberate and legally traceable

  # Automated coverage for this story lives in the inspector app:
  # - apps/inspector/src/composables/useFinalization.spec.ts
  # - apps/inspector/src/components/FinalizationConfirmDialog.spec.ts
  # - apps/inspector/__tests__/integration/finalization-flow.spec.ts
  # - apps/inspector/src/views/InspectionReviewView.spec.ts

  Background:
    Given the API is running
    And the inspector app is running

  @M8-S6 @finalization-prerequisite
  Scenario: Inspector is authenticated for field finalization workflows
    Given I am logged in as an inspector
    Then I should see my name in the header
