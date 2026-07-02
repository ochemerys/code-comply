@storage
Feature: S3-compatible object storage (Cloudflare R2 / MinIO)
  As the inspection platform
  I want evidence files in S3-compatible buckets
  So that photos and documents can be stored, retrieved, and accessed via signed URLs

  Scenario: Upload, download, and presign objects in photos and documents buckets
    Given object storage is configured for E2E
    And inspection storage buckets exist
    When I upload "e2e-smoke-photos" to the photos bucket at key "e2e/storage-smoke-photos.txt" with content type "text/plain"
    And I upload "e2e-smoke-docs" to the documents bucket at key "e2e/storage-smoke-docs.txt" with content type "text/plain"
    Then the photos object at key "e2e/storage-smoke-photos.txt" should contain text "e2e-smoke-photos"
    And the documents object at key "e2e/storage-smoke-docs.txt" should contain text "e2e-smoke-docs"
    And a signed GET URL for the photos object at key "e2e/storage-smoke-photos.txt" should return status 200 and body "e2e-smoke-photos"
    And I delete the photos object at key "e2e/storage-smoke-photos.txt"
    And I delete the documents object at key "e2e/storage-smoke-docs.txt"
