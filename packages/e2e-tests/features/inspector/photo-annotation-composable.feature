# M7-S5: usePhotoAnnotation — Fabric.js canvas tools (arrow, circle, text, undo, save)
# Executable coverage: @codecomply/inspector vitest (unit + integration).

Feature: Photo annotation composable behavior
  As an inspector marking up evidence in the Safety Codes Inspection PWA
  I need canvas-based arrows, circles, and text with undo and export
  So that deficiencies are clearly highlighted on photos

  @M7-S5
  Scenario: Photo annotation composable contract is covered by automated tests
    Given the photo annotation composable acceptance criteria are defined for M7-S5
    Then unit and integration tests should cover arrows, circles, text, undo, and save
