# M7-S12: PhotoAnnotator + AnnotationToolbar — full-screen preview, tools, undo, save
# Executable coverage: @codecomply/inspector vitest (unit + integration).

Feature: Photo annotator UI
  As an inspector marking up evidence photos in the field
  I need a full-screen preview with arrow, circle, text, undo, and save
  So that deficiencies are visually clear on submitted photos

  @M7-S12
  Scenario: Photo annotator UI acceptance criteria are covered by automated tests
    Given the photo annotator UI acceptance criteria are defined for M7-S12
    Then unit and integration tests should cover preview, toolbar, tools, undo, and save
