# M11-S20 — Production monitoring and alerting traceability (Sentry, uptime, Render ops).
@M11-S20 @ci @monitoring @infrastructure
Feature: Production monitoring and alerting (M11-S20)
  As a platform engineer
  I want error tracking, performance monitoring, and uptime alerts configured
  So that production issues are detected and escalated quickly

  @M11-S20 @traceability
  Scenario: M11-S20 acceptance criteria are defined for monitoring testing
    Given the production monitoring acceptance criteria are defined for M11-S20
    Then unit and integration tests should cover M11-S20 monitoring validators and API modules

  @M11-S20 @sentry
  Scenario: API and frontend Sentry modules are present for error tracking
    Given the M11-S20 monitoring artifact files are loaded
    Then the M11-S20 API should configure Sentry error tracking when SENTRY_DSN is set

  @M11-S20 @uptime
  Scenario: health endpoint supports external uptime monitoring
    Given the M11-S20 health route file is loaded
    Then the M11-S20 health endpoint should expose status for uptime checks
