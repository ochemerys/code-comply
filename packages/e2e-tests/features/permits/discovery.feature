@permits @permit-discovery
Feature: Permit Discovery
  As an inspector
  I want to discover permits using GPS and search
  So that I can quickly find inspection sites

  Background:
    Given I am logged in as an inspector
    And I am on the permits page

  Scenario: Successfully discover permits using GPS
    Given my device GPS is enabled
    And there are 5 permits within 2km of my location
    When I click the "Find Near Me" button
    Then I should see a loading indicator
    And the system should request my GPS location
    When my GPS location is obtained
    Then I should see "5 Permits Found"
    And I should see the permits sorted by distance
    And each permit should display permit number, address, status, and distance

  Scenario: GPS permission denied
    Given my device GPS is enabled
    But I have denied location permission
    When I click the "Find Near Me" button
    Then I should see a permit error message "Location permission denied"
    And I should see instructions to enable location access

  Scenario: GPS timeout
    Given my device GPS is enabled
    But the GPS signal is weak
    When I click the "Find Near Me" button
    And the GPS request times out after 10 seconds
    Then I should see a permit error message "Location request timed out"
    And I should be able to retry

  Scenario: No permits found nearby
    Given my device GPS is enabled
    And there are no permits within 5km of my location
    When I click the "Find Near Me" button
    And my GPS location is obtained
    Then I should see "No Permits Found"
    And I should see a message "No permits found in this area"
    And I should see a suggestion "Try increasing the search radius"

  Scenario: Change search radius
    Given my device GPS is enabled
    And I have already found nearby permits
    When I change the search radius to "10 km"
    Then the system should refetch permits with the new radius
    And I should see updated results

  Scenario: View permit details from discovery results
    Given my device GPS is enabled
    And I have found nearby permits
    When I click on a permit card
    Then I should be navigated to the permit detail page
    And I should see the full permit information

  Scenario: GPS not supported
    Given my device does not support GPS
    When I visit the permits page
    Then I should see a warning "GPS Not Supported"
    And the "Find Near Me" button should be disabled

  Scenario: Display distance in appropriate units
    Given my device GPS is enabled
    And there are permits at various distances:
      | Permit Number | Distance |
      | P-2024-001    | 50m      |
      | P-2024-002    | 999m     |
      | P-2024-003    | 1500m    |
      | P-2024-004    | 12345m   |
    When I find nearby permits
    Then I should see distances formatted as:
      | Permit Number | Display  |
      | P-2024-001    | 50 m     |
      | P-2024-002    | 999 m    |
      | P-2024-003    | 1.5 km   |
      | P-2024-004    | 12.3 km  |

  Scenario: Filter by permit status
    Given my device GPS is enabled
    And there are permits with different statuses nearby
    When I click the "Find Near Me" button
    And my GPS location is obtained
    And I select "ACTIVE" status filter
    Then I should only see permits with "ACTIVE" status

  Scenario: Limit results to closest permits
    Given my device GPS is enabled
    And there are 50 permits within 5km of my location
    When I click the "Find Near Me" button
    Then I should see a maximum of 20 permits
    And the permits should be the 20 closest to my location

  Scenario: Offline behavior during discovery
    Given I am offline
    And my device GPS is enabled
    When I click the "Find Near Me" button
    Then I should see an error message about network connectivity
    And I should be able to retry when back online

  @loading-states
  Scenario: Loading states during discovery
    Given my device GPS is enabled for loading states
    When I click the "Find Near Me" button
    Then the button should show "Getting Location..."
    And the button should be disabled
    And the radius selector should be disabled
    When my GPS location is obtained
    Then I should see "Searching for nearby permits..."
    And a loading spinner should be displayed
    When the results are loaded
    Then the controls should be enabled again

  Scenario: Geofence warning on permit detail
    Given my device GPS is enabled
    And I have found a permit
    When I click the first permit card
    And the permit has a geofence radius of 100m
    When I am more than 100m away from the permit location
    Then I should see a geofence warning
    And I should be notified that I am outside the inspection area
