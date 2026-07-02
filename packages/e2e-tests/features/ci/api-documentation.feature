# M11-S22 — Complete API documentation with OpenAPI (traceability).
@M11-S22 @ci @api-docs @documentation
Feature: Complete API documentation (M11-S22)
  As an API consumer
  I want comprehensive OpenAPI documentation with examples
  So that integrations are type-safe and self-service

  @M11-S22 @traceability
  Scenario: M11-S22 acceptance criteria are defined for API documentation testing
    Given the complete API documentation acceptance criteria are defined for M11-S22
    Then unit and integration tests should cover M11-S22 API documentation validators

  @M11-S22 @openapi
  Scenario: OpenAPI artifacts and README are present
    Given the M11-S22 API documentation artifact files are loaded
    Then the M11-S22 OpenAPI README should document authentication and error codes

  @M11-S22 @export
  Scenario: exported openapi.yaml contains required markers
    Given the M11-S22 exported OpenAPI YAML file is loaded
    Then the M11-S22 openapi.yaml should include bearer authentication documentation
