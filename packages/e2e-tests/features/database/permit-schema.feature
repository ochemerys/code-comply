# Feature: Permit Database Schema (M4-S1)
# 
# As a system administrator
# I want a robust permit database schema
# So that inspectors can find and view permit information efficiently

Feature: Permit Database Schema

  Background:
    Given the database is clean
    And the following permits exist:
      | permitNumber      | address                                    | legalLandDesc                  | scope                        | status    | latitude | longitude  |
      | BP-2024-E2E-001   | 10230 Jasper Avenue, Edmonton, AB T5J 4P6  | Plan 1234AB Block 5 Lot 12     | New Construction - Office    | ACTIVE    | 53.5461  | -113.4938  |
      | BP-2024-E2E-002   | 8882 170 Street NW, Edmonton, AB T5T 4J2   |                                | Renovation - Kitchen         | ACTIVE    | 53.5232  | -113.6289  |
      | BP-2024-E2E-003   | 11220 142 Street NW, Edmonton, AB T5M 1V1  |                                | Addition - Garage            | ACTIVE    | 53.5673  | -113.5789  |
      | BP-2023-E2E-100   | 12345 82 Street NW, Edmonton, AB T5B 2W3   |                                | Deck Addition                | COMPLETED | 53.5505  | -113.4658  |

  Scenario: Create a new permit with all required fields
    When I create a permit with the following details:
      | permitNumber | BP-2024-NEW-001                           |
      | address      | 123 Test Street, Edmonton, AB T5J 1A1     |
      | scope        | New Construction - Single Family Dwelling |
      | status       | ACTIVE                                    |
    Then the permit should be created successfully
    And the permit should have a unique ID
    And the permit should have timestamps

  Scenario: Create a permit with GPS coordinates
    When I create a permit with the following details:
      | permitNumber | BP-2024-GPS-001                       |
      | address      | 456 GPS Avenue, Edmonton, AB T5J 2B2  |
      | scope        | Renovation                            |
      | status       | ACTIVE                                |
      | latitude     | 53.5461                               |
      | longitude    | -113.4938                             |
    Then the permit should be created successfully
    And the permit should have GPS coordinates:
      | latitude  | 53.5461   |
      | longitude | -113.4938 |

  Scenario: Create a permit with legal land description
    When I create a permit with the following details:
      | permitNumber  | BP-2024-LEGAL-001                     |
      | address       | 789 Legal Lane, Edmonton, AB T5J 3C3  |
      | legalLandDesc | Plan 1234AB Block 5 Lot 12            |
      | scope         | Addition                              |
      | status        | ACTIVE                                |
    Then the permit should be created successfully
    And the permit should have legal land description "Plan 1234AB Block 5 Lot 12"

  Scenario: Enforce unique permit number constraint
    Given a permit exists with permit number "BP-2024-UNIQUE-001"
    When I attempt to create another permit with permit number "BP-2024-UNIQUE-001"
    Then the permit creation should fail
    And I should receive a unique constraint error

  Scenario: Find permit by permit number
    When I search for permit by permit number "BP-2024-E2E-001"
    Then I should find exactly 1 permit
    And the permit should have address "10230 Jasper Avenue, Edmonton, AB T5J 4P6"

  Scenario: Find permits by status
    When I search for permits with status "ACTIVE"
    Then I should find at least 3 permits
    And all permits should have status "ACTIVE"

  Scenario: Find permits by address (partial match)
    When I search for permits with address containing "Jasper"
    Then I should find at least 1 permit
    And all permits should have "Jasper" in their address

  Scenario: Find permits within GPS bounding box
    When I search for permits within GPS bounding box:
      | minLat | 53.54   |
      | maxLat | 53.56   |
      | minLon | -113.50 |
      | maxLon | -113.49 |
    Then I should find at least 1 permit
    And all permits should be within the bounding box

  Scenario: Find permits near a specific location
    When I search for permits near location:
      | latitude  | 53.5461   |
      | longitude | -113.4938 |
      | radius    | 1.0       |
    Then I should find at least 1 permit
    And the nearest permit should be "BP-2024-E2E-001"

  Scenario: Update permit status
    Given a permit exists with permit number "BP-2024-E2E-001"
    When I update the permit status to "COMPLETED"
    Then the permit status should be "COMPLETED"
    And the permit updatedAt timestamp should be updated

  Scenario: Link permit to inspection
    Given a permit exists with permit number "BP-2024-E2E-001"
    When I create an inspection for the permit with scheduled date "2024-06-01"
    Then the inspection should be linked to the permit
    And the permit should have 1 inspection

  Scenario: Support multiple inspections per permit
    Given a permit exists with permit number "BP-2024-E2E-001"
    When I create 3 inspections for the permit
    Then the permit should have 3 inspections
    And all inspections should be linked to the same permit

  Scenario: Query permits with pending inspections
    Given a permit exists with permit number "BP-2024-E2E-001"
    And the permit has an inspection with status "SCHEDULED"
    When I search for permits with pending inspections
    Then I should find the permit "BP-2024-E2E-001"
    And the permit should have at least 1 scheduled inspection

  Scenario: Exclude permits without GPS from location search
    Given a permit exists without GPS coordinates
    When I search for permits with GPS coordinates only
    Then the permit without GPS should not be in the results

  Scenario: Sort permits by permit number
    When I retrieve all permits sorted by permit number ascending
    Then the permits should be in ascending order by permit number

  Scenario: Paginate permit results
    When I retrieve permits with page size 2 and page 1
    Then I should receive exactly 2 permits
    When I retrieve permits with page size 2 and page 2
    Then I should receive different permits than page 1

  Scenario: Search by legal land description
    When I search for permits with legal land description containing "Block 5"
    Then I should find at least 1 permit
    And all permits should have "Block 5" in their legal land description

  Scenario: Combined search criteria (address AND status)
    When I search for permits with:
      | address | Edmonton |
      | status  | ACTIVE   |
    Then I should find at least 3 permits
    And all permits should have "Edmonton" in address
    And all permits should have status "ACTIVE"

  Scenario: Verify database indexes for performance
    When I query permits by permit number
    Then the query should complete in less than 100ms
    When I query permits by status
    Then the query should complete in less than 100ms
    When I query permits by GPS coordinates
    Then the query should complete in less than 100ms

  Scenario: Validate required fields
    When I attempt to create a permit without permit number
    Then the permit creation should fail
    And I should receive a validation error
    When I attempt to create a permit without address
    Then the permit creation should fail
    And I should receive a validation error
    When I attempt to create a permit without scope
    Then the permit creation should fail
    And I should receive a validation error

  Scenario: Default permit status to ACTIVE
    When I create a permit without specifying status
    Then the permit should be created successfully
    And the permit status should default to "ACTIVE"

  Scenario: Support all permit statuses
    When I create permits with all possible statuses:
      | ACTIVE    |
      | COMPLETED |
      | CANCELLED |
      | EXPIRED   |
    Then all permits should be created successfully
    And each permit should have its respective status
