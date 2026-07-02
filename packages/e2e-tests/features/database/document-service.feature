# M7-S8: DocumentService — R2 documents bucket + inspection_documents metadata

Feature: Document Service Domain
  As the inspection API
  I want document uploads tied to inspections with durable metadata
  So that evidence files are retrievable and auditable

  Background:
    Given document service E2E data is prepared

  Scenario: Upload stores object in storage and row in database
    When I upload a document via DocumentService
    Then the inspection_documents row should match the upload
    And the fake document storage should have recorded a put

  Scenario: Signed download URL comes from storage
    When I upload a document via DocumentService
    And I request a signed URL via DocumentService
    Then the fake document storage should have issued a presigned GET

  Scenario: Delete removes storage object and database row
    When I upload a document via DocumentService
    And I delete that document via DocumentService
    Then the document row should be gone
    And the fake document storage should have recorded a delete

  Scenario: List documents for an inspection
    When I upload two documents via DocumentService
    Then DocumentService getByInspection should return at least two rows
