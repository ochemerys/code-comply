# M7-S19: Evidence photo HTTP routes — requires R2-compatible env (skipped when unset).
@photo-api
Feature: Photo API routes
  As an authenticated inspector
  I want to upload and delete inspection photos over HTTP
  So that offline captures sync to object storage

  Background:
    Given photo API route E2E data is prepared

  Scenario: Upload photo via multipart POST
    When I POST multipart photo upload for the test inspection
    Then the photo API response status should be 201
    And the created photo should belong to the test inspection

  Scenario: Idempotent upload with same clientId
    When I POST multipart photo upload for the test inspection twice with the same clientId
    Then the second photo API response status should be 200
    And there should be one photo row for that clientId

  Scenario: Delete photo
    When I POST multipart photo upload for the test inspection
    And I DELETE the last created photo
    Then the photo API response status should be 204
