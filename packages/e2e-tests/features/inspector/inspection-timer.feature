# M5-S17: Inspection timer / duration display
# Executable coverage: @codecomply/inspector vitest (unit + integration).

Feature: Inspection timer and duration
  As an inspector using the Safety Codes Inspection PWA
  I need an elapsed-time timer while executing an inspection
  So that duration is visible, survives restarts, and is stored when the inspection completes

  @M5-S17
  Scenario: Inspection timer acceptance criteria are covered by automated tests
    Given the inspection timer acceptance criteria are defined for M5-S17
    Then unit and integration tests should cover start, display, persistence, stop on complete, and saving duration with the inspection
