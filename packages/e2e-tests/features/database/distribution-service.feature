@m10-s12 @database
Feature: Automated report distribution (M10-S12)
  As compliance staff
  I want reports and notices emailed after sync
  So that stakeholders receive documents automatically

  Scenario: Sync-triggered distribution emails stakeholders
    Given M10-S12 distribution test harness is ready
    When distribution runs after inspection sync
    Then inspection report delivery should be logged
