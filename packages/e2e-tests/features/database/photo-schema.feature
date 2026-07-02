# M7-S1: Photo database schema (metadata, R2 storageKey, offline clientId)

Feature: Photo Database Schema

  Background:
    Given the photo schema test database is prepared

  Scenario: Persist photo with metadata and optional storage key
    When I create a photo with filename "evidence-e2e.jpg" and pending upload
    Then the photo should have mime type "image/jpeg"
    And the photo metadata should include permit number "BP-E2E-M7"

  Scenario: Link photo to deficiency
    When I create a deficiency and a photo linked to it
    Then the photo should reference that deficiency
