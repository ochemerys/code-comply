# M7-S13: PhotoGallery + PhotoThumbnail — grid, full view, delete, add, empty state, offline IndexedDB
# Executable coverage: @codecomply/inspector vitest (unit + integration).

Feature: Photo gallery UI
  As an inspector reviewing evidence in the field
  I need a gallery with thumbnails, full-screen view, safe delete, and camera add
  So that inspection photos are easy to manage offline

  @M7-S13
  Scenario: Photo gallery UI acceptance criteria are covered by automated tests
    Given the photo gallery UI acceptance criteria are defined for M7-S13
    Then unit and integration tests should cover thumbnails, full view, delete, add, empty state, and offline photos
