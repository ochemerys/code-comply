# M7-S11: Camera capture UI — viewfinder, preview, retake, accept
# Executable coverage: @codecomply/inspector vitest — CameraCapture.spec.ts, camera-capture-view.spec.ts, usePhotoCapture.spec.ts

Feature: Camera capture UI for inspection evidence
  As an inspector using the Safety Codes Inspection PWA
  I need a camera viewfinder with capture, preview, retake, and accept
  So that I can record photos reliably on mobile browsers including iOS Safari

  @M7-S11
  Scenario: Camera capture UI acceptance criteria are covered by automated tests
    Given the camera capture UI acceptance criteria are defined for M7-S11
    Then unit and integration tests should cover viewfinder, capture, preview, retake, accept, and facing-mode switching
