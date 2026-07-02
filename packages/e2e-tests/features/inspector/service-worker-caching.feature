# M11-S10: Service worker runtime caching strategies
# Executable coverage: @codecomply/inspector vitest — sw-caching-config.spec.ts, service-worker-caching.spec.ts

@M11-S10 @inspector @performance @pwa
Feature: Service worker caching strategies
  As an inspector using the PWA offline
  I want API, image, static, and font resources cached appropriately
  So that the app stays fast and usable without connectivity

  Scenario: M11-S10 caching acceptance criteria are covered by automated tests
    Given the service worker caching acceptance criteria are defined for M11-S10
    Then unit and integration tests should cover M11-S10 offline and cache size targets
