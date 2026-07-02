# M7-S14: VoiceInputButton — press-and-hold voice field input
# Executable coverage: @codecomply/inspector vitest (unit + integration).

Feature: Voice input button for inspection forms
  As an inspector completing deficiency notes in the field
  I need a press-and-hold microphone control with clear states
  So that transcripts are emitted safely after each dictation gesture

  @M7-S14
  Scenario: Voice input button acceptance criteria are covered by automated tests
    Given the voice input button acceptance criteria are defined for M7-S14
    Then unit and integration tests should cover render, record, processing, stop, and transcript emission
