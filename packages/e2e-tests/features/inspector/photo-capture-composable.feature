# M7-S2: usePhotoCapture composable — Web Capture API (getUserMedia + still capture)
# Executable coverage: @codecomply/inspector vitest (unit + integration).

Feature: Photo capture composable behavior
  As an inspector capturing evidence in the Safety Codes Inspection PWA
  I need reliable camera access and still capture via the Web Capture API
  So that photos can be taken consistently on mobile browsers including iOS Safari

  @M7-S2
  Scenario: Photo capture composable contract is covered by automated tests
    Given the photo capture composable acceptance criteria are defined for M7-S2
    Then unit and integration tests should cover stream lifecycle, capture, and permission errors
