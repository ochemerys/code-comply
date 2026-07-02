# E2E Test Reports

This directory contains generated test reports from Cucumber/Playwright E2E tests.

**Files in this directory are NOT committed to git.**

## Generated Files

- `cucumber-report.html` - HTML test report
- `cucumber-report.json` - JSON test results
- Playwright traces and screenshots (on test failure)

## Viewing Reports

After running E2E tests:

```bash
# Run E2E tests
pnpm test:e2e

# Open HTML report
open packages/e2e-tests/reports/cucumber-report.html
```

## CI/CD

In CI/CD, these reports are uploaded as artifacts and retained for 7 days.
