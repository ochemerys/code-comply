# M3-S4: Background Sync tag registration in a real browser (Playwright + Cucumber)
# Complements @codecomply/inspector vitest — background-sync.spec.ts

@M3-S4 @inspector @critical @pwa
Feature: Background Sync registration
  As a Safety Codes Officer using the Inspector PWA
  I need background sync tags registered when connectivity returns
  So that offline mutations sync automatically

  Background:
    Given I am logged in as an inspector

  Scenario: Background Sync registers data sync tags when supported
    Given the browser has a service worker registration for background sync
    When the background sync manager is initialized in the browser
    Then the following sync tags should be registered:
      | tag               |
      | inspection-sync   |
      | deficiency-sync   |
      | photo-sync        |

  Scenario: Fallback periodic sync starts when Background Sync is unavailable
    Given the browser does not support Background Sync API
    When a fresh background sync manager is initialized without Background Sync support
    Then the background sync fallback should be active
    And no background sync tags should be registered
