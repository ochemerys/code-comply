@M11-S3 @api @security @critical
Feature: RBAC separation between inspectors and admins (M11-S3)
  As a security engineer
  I want strict role separation on API routes
  So that inspectors cannot access admin-only functionality

  Scenario: SCO cannot access admin user management API
    Given an authenticated SCO user for RBAC tests
    When the SCO requests the admin users API
    Then the RBAC API response status should be 403
    And the RBAC API response should indicate forbidden

  Scenario: Admin can access admin user management API
    Given an authenticated admin user for RBAC tests
    When the admin requests the admin users API
    Then the RBAC API response status should be 200

  Scenario: SCO cannot access VoC admin review queue
    Given an authenticated SCO user for RBAC tests
    When the SCO requests the VoC pending queue API
    Then the RBAC API response status should be 403
