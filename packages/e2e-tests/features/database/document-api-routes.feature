# M7-S9: Document HTTP routes — requires R2-compatible env (skipped when unset).
@document-api
Feature: Document API routes
  As an authenticated inspector
  I want to upload and manage inspection documents over HTTP
  So that evidence files are available through the API

  Background:
    Given document API route E2E data is prepared

  Scenario: Upload document via multipart POST
    When I POST multipart document upload for the test inspection
    Then the document API response status should be 201
    And the created document should belong to the test inspection

  Scenario: Get signed URL for uploaded document
    When I POST multipart document upload for the test inspection
    And I GET signed URL for the last created document
    Then the document API response status should be 200
    And the signed URL response should include url and expiresIn

  Scenario: List documents for inspection
    When I POST multipart document upload for the test inspection
    And I GET documents list for the test inspection
    Then the document API response status should be 200
    And the documents list should include the last created document

  Scenario: Delete document
    When I POST multipart document upload for the test inspection
    And I DELETE the last created document
    Then the document API response status should be 204
