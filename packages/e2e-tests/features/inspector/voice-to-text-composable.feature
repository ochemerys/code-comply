# M7-S6: useVoiceToText — Web Speech API composable
# Executable coverage: @codecomply/inspector vitest (unit + integration).

Feature: Voice-to-text composable behavior
  As an inspector dictating notes in the Safety Codes Inspection PWA
  I need speech recognition with clear start/stop and offline-safe errors
  So that deficiency notes can be captured hands-free in the field

  @M7-S6
  Scenario: Voice-to-text composable contract is covered by automated tests
    Given the voice-to-text composable acceptance criteria are defined for M7-S6
    Then unit and integration tests should cover listen, stop, transcript, clear, and support detection
