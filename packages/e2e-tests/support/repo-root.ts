import { resolve } from 'node:path'

/**
 * Monorepo root. Cucumber runs with cwd = packages/e2e-tests (local pnpm scripts and Docker start.sh).
 */
export const REPO_ROOT = resolve(process.cwd(), '../..')
