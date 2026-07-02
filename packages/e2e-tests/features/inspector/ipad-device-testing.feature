# M11-S17 — Automated WebKit proxy tests for physical iPad acceptance criteria.
# Physical device QA uses _docs/development/03-implementation/m11-s17-ipad-device-test-checklist.md
# Browser: E2E_BROWSER=webkit (Safari engine). Viewports: iPad Pro, Air, mini profiles.
@M11-S17 @inspector @ipad @device @e2e
Feature: iPad device testing (M11-S17)
  As a QA engineer
  I want WebKit E2E coverage at iPad viewports
  So that physical iPad field tests have an automated baseline before device sign-off

  Background:
    Given the API is running
    And the inspector app is running

  @M11-S17 @gps @camera @touch-interactions
  Scenario: Device APIs available on iPad Pro landscape
    Given M11-S17 iPad device is "ipad-pro-12-9"
    And M11-S17 iPad orientation is "landscape"
    When I open the inspector home page for M11-S17
    Then the M11-S17 geolocation API should be available
    And the M11-S17 camera API should be available
    And the M11-S17 touch target minimum should be met

  @M11-S17 @offline @work-offline
  Scenario: Offline mode indicator on iPad mini
    Given M11-S17 iPad device is "ipad-mini"
    And M11-S17 iPad orientation is "portrait"
    And I am on the login page
    And I am offline
    Then the sign in button should be disabled
    And I should see an offline warning message

  @M11-S17 @complete-inspection @sync-data
  Scenario: Inspector completes checklist shell on iPad Air
    Given M11-S17 iPad device is "ipad-air"
    And M11-S17 iPad orientation is "portrait"
    And I am logged in as an inspector
    And M11-S16 inspection workflow data is prepared
    When I open the M11-S16 checklist execution page
    Then I should see the M11-S16 checklist execution shell

  @M11-S17 @traceability
  Scenario: M11-S17 acceptance criteria are defined for automated and manual testing
    Given the iPad device testing acceptance criteria are defined for M11-S17
    Then unit and integration tests should cover M11-S17 iPad device profiles and capabilities
