# M7-S10: Offline photo storage in IndexedDB with sync queue and limits
# Executable coverage: @codecomply/inspector vitest — photo-storage.spec.ts, useOfflinePhotos.spec.ts, __tests__/integration/offline-photos-storage.spec.ts

Feature: Offline inspection photo storage
  As an inspector
  I want photos kept locally with metadata when I am offline
  So that evidence queues safely for upload without exceeding device limits

  Scenario: Offline photo storage acceptance criteria for M7-S10 are covered by automated tests
    Given the offline photo storage acceptance criteria are defined for M7-S10
    Then unit and integration tests should cover IndexedDB blobs, queueing, progress, limits, and retries
