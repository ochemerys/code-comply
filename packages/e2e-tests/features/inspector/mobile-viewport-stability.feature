@inspector @mobile @viewport @P3-dvh
Feature: Mobile viewport stability
  As an inspector using Safari on a phone
  I want the app shell to follow the dynamic viewport
  So that the bottom navigation does not jump when browser chrome collapses

  Background:
    Given the API is running
    And the inspector app is running

  Scenario Outline: Bottom navigation remains flush on <page> with iPhone 13 viewport
    Given the P3 mobile viewport is "iPhone 13"
    And I am logged in as an inspector
    When I open the P3 viewport stability page "<path>"
    And I scroll until the mobile browser chrome would collapse
    Then the P3 bottom navigation should be flush with the viewport bottom

    Examples:
      | page    | path     |
      | Home    | /        |
      | Profile | /profile |
