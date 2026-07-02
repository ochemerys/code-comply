# M11-S16 — Playwright E2E coverage for critical cross-app user journeys.
# Browser matrix: E2E_BROWSER=chromium|webkit (default chromium in CI).
# Viewports: @desktop @tablet @mobile tags drive setViewportSize in step hooks.
@M11-S16 @workflows @e2e @critical
Feature: Critical user journeys (Playwright E2E)
  As a product owner
  I want stable Playwright journeys across browsers and viewports
  So that production regressions are caught before release

  Background:
    Given the API is running
    And the inspector app is running
    And the admin app is running

  @M11-S16 @inspector @journey-inspector
  Scenario Outline: Inspector signs in and opens checklist execution on <viewport>
    Given M11-S16 E2E viewport is "<viewport>"
    And I am logged in as an inspector
    And M11-S16 inspection workflow data is prepared
    When I open the M11-S16 checklist execution page
    Then I should see the M11-S16 checklist execution shell

    Examples:
      | viewport |
      | desktop  |
      | tablet   |
      | mobile   |

  @M11-S16 @admin @journey-admin @desktop
  Scenario: Administrator signs in and views the user registry
    Given M11-S16 E2E viewport is "desktop"
    And I am signed in as an admin
    When I open the admin users page
    Then I should see the admin users registry shell

  @M11-S16 @reporting @journey-report @desktop
  Scenario: Report PDF is generated and downloadable from the admin portal
    Given M11-S16 E2E viewport is "desktop"
    And I am signed in as an admin
    And M10-S17 reporting test data is prepared
    When an inspection report PDF is generated for M10-S17
    Then the M10-S17 report should be a valid PDF with stored metadata
    And a signed download URL should be available for the M10-S17 report
    When I open the admin reports page for the M10-S17 inspection
    And I download the M10-S17 report from report history
    Then the M10-S17 report download request should succeed

  @M11-S16 @offline @journey-offline @mobile
  Scenario: Offline login is blocked on mobile viewport
    Given M11-S16 E2E viewport is "mobile"
    And I am on the login page
    And I am offline
    Then the sign in button should be disabled
    And I should see an offline warning message
