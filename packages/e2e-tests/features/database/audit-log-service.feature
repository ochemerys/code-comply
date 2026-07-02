# M8-S8: Append-only audit log — domain service + DB behavior

Feature: Audit Log Service (append-only)
  As the inspection API
  I want immutable audit entries for inspection-related changes
  So that compliance and forensic review can rely on the audit trail

  Scenario: Append creates log rows retrievable by entity
    Given audit log E2E seed data is prepared
    When I append an audit entry for the seeded inspection
    Then listing logs for that inspection includes the new action
