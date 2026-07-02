# Load tests (M11-S13)

k6 scripts for staging/production load validation. CI uses Vitest integration tests in `apps/api/__tests__/integration/load-testing.integration.spec.ts`.

## Prerequisites

Install [k6](https://k6.io/docs/get-started/installation/) and set:

```bash
export BASE_URL=http://localhost:3000
export AUTH_TOKEN=<jwt>   # required for sync / PDF scenarios
```

## Scenarios

| Script            | Story target              | Command                                   |
| ----------------- | ------------------------- | ----------------------------------------- |
| `api-health.js`   | 100 concurrent API calls  | `k6 run tools/load-tests/api-health.js`   |
| `sync-push.js`    | 50 concurrent syncs       | `k6 run tools/load-tests/sync-push.js`    |
| `pdf-generate.js` | 10 concurrent PDF reports | `k6 run tools/load-tests/pdf-generate.js` |

Thresholds mirror `apps/api/src/lib/load-test/load-test-config.ts`.
