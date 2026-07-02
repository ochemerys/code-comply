# M11-S19 — Production CI/CD pipeline traceability (workflow structure + deploy gates).
@M11-S19 @ci @cicd @pipeline
Feature: Production CI/CD pipeline (M11-S19)
  As a platform engineer
  I want a complete GitHub Actions pipeline with staging and production deploy gates
  So that every PR is tested and merges promote safely to Render environments

  @M11-S19 @traceability
  Scenario: M11-S19 acceptance criteria are defined for pipeline and deployment testing
    Given the production CI CD pipeline acceptance criteria are defined for M11-S19
    Then unit and integration tests should cover M11-S19 pipeline stages and workflow validators

  @M11-S19 @pipeline-structure
  Scenario: ci.yml defines all required pipeline stages
    Given the M11-S19 CI workflow file is loaded
    Then the M11-S19 CI workflow should contain all pipeline stages

  @M11-S19 @deployment
  Scenario: staging and production deploy workflows support manual rollback
    Given the M11-S19 deploy workflow files are loaded
    Then the M11-S19 deploy workflows should support manual rollback via workflow_dispatch
