# M11-S23 — Create user guides for inspectors and admins (traceability).
@M11-S23 @ci @user-guides @documentation
Feature: Create user guides (M11-S23)
  As a product owner
  I want complete inspector and admin user guides
  So that field and office staff can self-serve daily tasks

  @M11-S23 @traceability
  Scenario: M11-S23 acceptance criteria are defined for user guide testing
    Given the user guides acceptance criteria are defined for M11-S23
    Then unit and integration tests should cover M11-S23 user guide validators

  @M11-S23 @inspector
  Scenario: Inspector guide documents required sections and screenshots
    Given the M11-S23 inspector user guide is loaded
    Then the M11-S23 inspector guide should include all required sections and steps

  @M11-S23 @admin
  Scenario: Admin guide documents required sections and screenshots
    Given the M11-S23 admin user guide is loaded
    Then the M11-S23 admin guide should include all required sections and steps
