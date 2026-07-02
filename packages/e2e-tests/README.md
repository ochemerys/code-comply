# E2E Tests Package

This package contains BDD (Behavior-Driven Development) feature files and step definitions for end-to-end testing of **CodeComply** — the open source inspection management system.

## Overview

The tests are organized by application area and cover all functional requirements from the [CodeComply Requirements Specification](../../_docs/requirements/safety-codes-inspection-system-requirements.md).

## Feature File Organization

```
features/
├── inspector/                    # CodeComply Field features
│   ├── authentication.feature    # M-01: Authentication & Authority
│   ├── permit-retrieval.feature  # M-02: Site & Permit Retrieval
│   ├── offline-sync.feature      # M-03: Offline Workflow
│   ├── checklist-execution.feature # M-04: Inspection Execution
│   ├── evidence-capture.feature  # M-05: Evidence & Orders
│   ├── finalization.feature      # M-06: Finalization
│   ├── deficiency-management.feature # LSC-A-04: Deficiency Management
│   ├── device-security.feature   # M-07: Device Security Controls
│   ├── pwa-capabilities.feature  # NFR-M-04: PWA Specific
│   ├─�� inspection-creation.feature
│   └── photo-capture.feature
│
├── admin/                        # CodeComply Admin features (Part B) — all run in CI
│   ├── admin-user-list.feature   # A-01: User & Certification Management
│   ├── users.feature             # A-01: User management journeys
│   ├── permit-assignment.feature # A-02: Permit & Assignment Management
│   ├── assignments.feature       # A-02: Assignment & monitoring journeys
│   ├── admin-assignment-grid.feature   # A-02: Assignment grid route
│   ├── admin-bulk-assignment.feature   # A-02: Bulk assignment route
│   ├── admin-workload-calendar.feature # A-02: Workload calendar route
│   ├── checklist-configuration.feature # A-03: Checklist & Code Configuration
│   ├── report-generation.feature # A-04: Reporting & Distribution Engine
│   ├── order-processing.feature  # A-05: Order Processing
│   ├── admin-inspection-monitor.feature # A-05: Inspection monitor route
│   ├── admin-compliance-search.feature # A-06: Records & Compliance (FOIP search)
│   ├── admin-portal-shell.feature      # Shell / navigation
│   ├── admin-auth-access.feature       # Authentication messaging
│   ├── admin-content-security-policy.feature # NFR-A-01: CSP
│   └── lazy-loading.feature      # M11-S8: lazy-loaded routes
│
├── api/                          # API-specific features
│   ├── authentication.feature    # Authentication API
│   ├── rbac.feature              # Role-Based Access Control
│   ├── sync.feature              # Offline Sync API
│   ├── deficiency.feature        # Deficiency API
│   └── inspection.feature        # Inspection API
│
└── workflows/                    # Cross-application workflows
    ├── complete-inspection-workflow.feature # End-to-end workflows
    ├── deficiency-voc.feature    # Deficiency → VoC workflow
    ├── inspector-to-admin.feature # Data flow between apps
    ├── inspection-dates.feature  # LSC-A-01: Date Management
    ├── inspection-stages.feature # LSC-A-02: Inspection Stages
    ├── unable-to-enter.feature   # LSC-A-03: Unable to Enter
    ├── verification-of-compliance.feature # LSC-A-05: VoC
    └── document-management.feature # LSC-A-06: Documents
```

## Requirement Coverage

### CodeComply Field (Part A)

| Requirement                     | Feature File                              | Scenarios |
| ------------------------------- | ----------------------------------------- | --------- |
| M-01 Authentication & Authority | `inspector/authentication.feature`        | 9         |
| M-02 Site & Permit Retrieval    | `inspector/permit-retrieval.feature`      | 9         |
| M-03 Offline Workflow           | `inspector/offline-sync.feature`          | 4         |
| M-04 Inspection Execution       | `inspector/checklist-execution.feature`   | 13        |
| M-05 Evidence & Orders          | `inspector/evidence-capture.feature`      | 13        |
| M-06 Finalization               | `inspector/finalization.feature`          | 14        |
| M-07 Device Security            | `inspector/device-security.feature`       | 10        |
| NFR-M-04 PWA Specific           | `inspector/pwa-capabilities.feature`      | 12        |
| LSC-A-04 Deficiency Management  | `inspector/deficiency-management.feature` | 14        |

### CodeComply Admin (Part B)

Every admin feature below lives under `features/admin/` and is executed by the
`e2e-tests` CI job on any PR touching `apps/**` or `packages/**` (which includes
`apps/admin` and `apps/api`). None are tagged `@wip`, so a failing scenario fails
the job and blocks merge. The previous aspirational placeholders under
`features/_archive/admin/` have been **removed** now that Part B is implemented.

| Requirement                   | Owning Feature File(s)                                                                                                                                                                | Tag(s)                 |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| A-01 User & Certification     | `admin/admin-user-list.feature`, `admin/users.feature`                                                                                                                                | `@admin`               |
| A-02 Permit & Assignment      | `admin/permit-assignment.feature`, `admin/assignments.feature`, `admin/admin-assignment-grid.feature`, `admin/admin-bulk-assignment.feature`, `admin/admin-workload-calendar.feature` | `@A-02`                |
| A-03 Checklist & Code Config  | `admin/checklist-configuration.feature`                                                                                                                                               | `@A-03`                |
| A-04 Reporting & Distribution | `admin/report-generation.feature`                                                                                                                                                     | `@A-04`                |
| A-05 Order Processing         | `admin/order-processing.feature`, `admin/admin-inspection-monitor.feature`                                                                                                            | `@A-05`                |
| A-06 Records & Compliance     | `admin/admin-compliance-search.feature` (+ `database/addendum-model.feature`, `database/append-only-inspection.feature`)                                                              | `@A-06`, `@compliance` |
| Shell / Auth / Security       | `admin/admin-portal-shell.feature`, `admin/admin-auth-access.feature`, `admin/admin-content-security-policy.feature`                                                                  | `@admin`, `@NFR-A-01`  |

Run only the admin suite locally:

```bash
pnpm --filter e2e-tests test:admin
```

### Legacy System Compatibility

| Requirement                  | Feature File                                   | Scenarios |
| ---------------------------- | ---------------------------------------------- | --------- |
| LSC-A-01 Inspection Dates    | `workflows/inspection-dates.feature`           | 5         |
| LSC-A-02 Inspection Stages   | `workflows/inspection-stages.feature`          | 5         |
| LSC-A-03 Unable to Enter     | `workflows/unable-to-enter.feature`            | 7         |
| LSC-A-05 VoC                 | `workflows/verification-of-compliance.feature` | 10        |
| LSC-A-06 Document Management | `workflows/document-management.feature`        | 11        |

### API Features

| Feature        | Feature File                 | Scenarios |
| -------------- | ---------------------------- | --------- |
| Authentication | `api/authentication.feature` | 5         |
| RBAC           | `api/rbac.feature`           | 7         |
| Sync           | `api/sync.feature`           | 10        |
| Deficiency     | `api/deficiency.feature`     | 13        |
| Inspection     | `api/inspection.feature`     | 12        |

### End-to-End Workflows

| Workflow            | Feature File                                     | Scenarios |
| ------------------- | ------------------------------------------------ | --------- |
| Complete Inspection | `workflows/complete-inspection-workflow.feature` | 6         |
| Deficiency → VoC    | `workflows/deficiency-voc.feature`               | 6         |
| Inspector ↔ Admin   | `workflows/inspector-to-admin.feature`           | 6         |

## Total Scenario Count

| Category         | Scenarios |
| ---------------- | --------- |
| CodeComply Field | ~98       |
| CodeComply Admin | ~61       |
| API              | ~47       |
| Workflows        | ~50       |
| **Total**        | **~256**  |

## Running Tests

```bash
# Run all E2E tests
pnpm --filter e2e-tests test

# Run specific feature
pnpm --filter e2e-tests test -- features/inspector/authentication.feature

# Run tests with specific tag
pnpm --filter e2e-tests test -- --tags @offline

# Run tests in CI mode
pnpm --filter e2e-tests test:ci

# Generate HTML report
pnpm --filter e2e-tests test -- --format html:reports/cucumber-report.html
```

## Tags

Features and scenarios are tagged for filtering:

### Application Tags

- `@inspector` - CodeComply Field features
- `@admin` - CodeComply Admin features
- `@api` - API features
- `@workflow` - Cross-application workflows

### Requirement Tags

- `@M-01` through `@M-07` - Mobile app requirements
- `@A-01` through `@A-06` - Admin requirements
- `@LSC-A-01` through `@LSC-A-06` - Legacy system compatibility
- `@NFR-M-01` through `@NFR-M-04` - Non-functional requirements

### Feature Tags

- `@authentication` - Authentication features
- `@offline` - Offline functionality
- `@sync` - Synchronization features
- `@deficiency` - Deficiency management
- `@checklist` - Checklist execution
- `@photo` - Photo capture
- `@signature` - Digital signature
- `@voc` - Verification of Compliance
- `@stop-work` - Stop Work orders
- `@pwa` - PWA-specific features

### Priority Tags

- `@critical` - Critical path scenarios
- `@happy-path` - Main success scenarios

## Writing New Features

### Feature File Template

```gherkin
@app @requirement @feature
Feature: Feature Name
  As a [role]
  I want to [action]
  So that [benefit]

  # Requirement: [Requirement ID and Name]

  Background:
    Given [common setup]

  @scenario-tag
  Scenario: Scenario name
    Given [precondition]
    When [action]
    Then [expected result]
```

### Best Practices

1. **Use business language** - Write scenarios in terms stakeholders understand
2. **Keep scenarios independent** - Each scenario should be self-contained
3. **Use Background for common setup** - Avoid repetition
4. **Tag appropriately** - Enable filtering and reporting
5. **Reference requirements** - Link to requirement IDs
6. **Test one thing per scenario** - Keep scenarios focused

## Step Definitions

Step definitions are located in `step-definitions/` and organized by domain:

```
step-definitions/
├── inspector/
│   ├── authentication.steps.ts
│   ├── checklist.steps.ts
│   └── deficiency.steps.ts
├── admin/
│   ├── user-management.steps.ts
│   └── scheduling.steps.ts
├── api/
│   ├── auth.steps.ts
│   └── inspection.steps.ts
└── shared/
    ├── common.steps.ts
    └── assertions.steps.ts
```

## Configuration

See `cucumber.js` for Cucumber configuration options.

## Reports

Test reports are generated in `reports/`:

- `cucumber-report.html` - HTML report
- `cucumber-report.json` - JSON report for CI integration

## Related Documentation

- [Testing Strategy](../../_docs/internal/development/01-governance/testing-strategy.md)
- [CodeComply Requirements Specification](../../_docs/requirements/safety-codes-inspection-system-requirements.md)
- [Development Plan](../../_docs/internal/development/01-governance/development-plan.md)
