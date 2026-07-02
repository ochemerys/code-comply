@m10-s8 @database
Feature: Append-only finalized inspections (M10-S8)
  As compliance staff
  I want finalized inspections to be immutable
  So that only addendums can amend the legal record

  Scenario: Block mutation and allow addendum on finalized inspection
    Given M10-S8 append-only test data is prepared
    When an unauthorized update is attempted on the finalized inspection
    Then the update should be rejected as immutable
    When an addendum is added to the finalized inspection
    Then the addendum should be stored for that inspection
