# M7-S18 — Photo annotation E2E (dev route + Fabric canvas).
@M7-S18
Feature: Evidence photo annotation
  As an inspector marking up evidence photos
  I need the annotation tools to work in a real browser
  So that arrow markup and save export a usable image

  Background:
    Given evidence E2E media mocks are installed
    And I am logged in as an inspector

  Scenario: User draws an arrow and saves an annotated image
    Given I navigate to the dev annotation screen
    When I draw an arrow annotation and save
    Then the annotation save confirmation should be visible
