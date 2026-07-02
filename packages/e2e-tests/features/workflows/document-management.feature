@admin-document-mgmt @document-api
Feature: Admin document management (API)
  Administrators manage uploaded and generated inspection documents via the document hub API.

  Background:
    Given document API route E2E data is prepared

  @upload @documents
  Scenario: Upload and list supporting documents for an inspection
    When I POST multipart document upload for the test inspection
    Then the document API response status should be 201
    And the created document should belong to the test inspection
    When I GET documents list for the test inspection
    Then the document API response status should be 200
    And the documents list should include the last created document

  @email @document
  Scenario: Email uploaded document with audit trail
    Given an admin user exists for document workflow E2E
    When I POST multipart document upload for the test inspection
    Then the document API response status should be 201
    When I POST admin email for the last created document to "owner@example.com"
    Then the document API response status should be 200
    And the document email result status should be sent

  @electronic-signing
  Scenario: Sign uploaded document
    Given an admin user exists for document workflow E2E
    When I POST multipart document upload for the test inspection
    Then the document API response status should be 201
    When I POST admin sign for the last created document
    Then the document API response status should be 200
    And the signed document metadata should include signedAt
