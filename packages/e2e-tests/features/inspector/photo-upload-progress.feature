# M7-S15: UploadProgress — progress bar, counts, failed highlight, retry, cancel
# Executable coverage: @codecomply/inspector vitest (unit + integration).

Feature: Photo upload progress UI
  As an inspector uploading evidence in the field
  I need clear upload progress, counts, and recovery actions
  So that I can retry failures and cancel mistaken pending uploads

  @M7-S15
  Scenario: Photo upload progress acceptance criteria are covered by automated tests
    Given the photo upload progress acceptance criteria are defined for M7-S15
    Then unit and integration tests should cover progress bar, counts, failed highlight, retry, and cancel
