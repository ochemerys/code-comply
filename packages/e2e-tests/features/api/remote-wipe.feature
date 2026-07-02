@M11-S4 @api @security @critical
Feature: Remote wipe for lost inspector devices (M11-S4)
  As an admin
  I want to trigger a remote wipe for an inspector device
  So that local data is cleared when a device is lost or stolen

  Scenario: Admin can trigger remote wipe for an inspector
    Given an authenticated admin user for remote wipe tests
    When the admin triggers remote wipe for inspector "sco-wipe-target"
    Then the remote wipe API response status should be 200
    And the remote wipe API response should indicate wipe requested

  Scenario: Inspector with pending wipe cannot access sync API
    Given an authenticated SCO user with pending remote wipe
    When the SCO requests the sync status API for remote wipe tests
    Then the remote wipe API response status should be 403

  Scenario: Inspector can confirm remote wipe completion
    Given an authenticated SCO user with pending remote wipe
    When the SCO confirms remote wipe on the device API
    Then the remote wipe API response status should be 200
