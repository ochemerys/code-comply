# M11-S18 — Automated WCAG 2.1 AA proxy tests for inspector and admin shells.
# Manual VoiceOver / Lighthouse QA uses _docs/development/03-implementation/m11-s18-accessibility-audit-checklist.md
@M11-S18 @inspector @accessibility @a11y @e2e
Feature: Accessibility audit (M11-S18)
  As a QA engineer
  I want automated axe-core and keyboard checks on auth shells
  So that WCAG 2.1 AA compliance has a CI baseline before manual screen reader sign-off

  Background:
    Given the API is running
    And the inspector app is running

  @M11-S18 @axe @inspector-login
  Scenario: Inspector login passes axe-core WCAG 2.1 AA on the sign-in form
    When I open the inspector login page for M11-S18
    Then the M11-S18 axe scan on the login form should have no violations
    And the M11-S18 login page should meet keyboard and screen reader checks

  @M11-S18 @keyboard-nav @focus-indicators
  Scenario: Inspector login supports keyboard focus order
    When I open the inspector login page for M11-S18
    Then the M11-S18 login focus order should be keyboard accessible
    And the M11-S18 focus indicators should be visible on interactive elements

  @M11-S18 @color-contrast
  Scenario: Inspector login text meets WCAG AA contrast
    When I open the inspector login page for M11-S18
    Then the M11-S18 login heading contrast should meet WCAG AA

  @M11-S18 @admin-login @axe
  Scenario: Admin portal login passes axe-core on the sign-in form
    Given the admin app is running
    When I open the admin login page for M11-S18
    Then the M11-S18 axe scan on the login form should have no violations

  @M11-S18 @traceability
  Scenario: M11-S18 acceptance criteria are defined for automated and manual testing
    Given the accessibility audit acceptance criteria are defined for M11-S18
    Then unit and integration tests should cover M11-S18 WCAG criteria and accessibility probes
