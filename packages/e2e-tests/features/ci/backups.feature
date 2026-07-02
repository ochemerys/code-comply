# M11-S21 — Geo-redundant database backup traceability (daily pg_dump, R2, restore).
@M11-S21 @ci @backups @infrastructure
Feature: Geo-redundant database backups (M11-S21)
  As a platform engineer
  I want automated daily backups with cross-region storage
  So that the inspection database can be recovered after failure

  @M11-S21 @traceability
  Scenario: M11-S21 acceptance criteria are defined for backup testing
    Given the geo-redundant backup acceptance criteria are defined for M11-S21
    Then unit and integration tests should cover M11-S21 backup validators and integrity helpers

  @M11-S21 @backup-script
  Scenario: backup and restore scripts are present for daily backups
    Given the M11-S21 backup artifact files are loaded
    Then the M11-S21 backup script should support pg_dump and geo-redundant R2 upload

  @M11-S21 @restore
  Scenario: restore script documents data integrity verification
    Given the M11-S21 restore script file is loaded
    Then the M11-S21 restore script should verify PostgreSQL dump integrity before apply
