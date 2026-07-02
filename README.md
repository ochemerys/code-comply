# CodeComply

**CodeComply** — open source inspection management for agencies operating under Alberta's Safety Codes Act. A monorepo for safety codes inspection management with offline-first PWA capabilities.

> CodeComply is an open source inspection management system designed and developed to
> support workflows under the Alberta Safety Codes Act (RSA 2000, c. S-1), the Freedom
> of Information and Protection of Privacy Act (RSA 2000, c. F-25), and Safety Codes
> Inspection Notice of Compliance requirements. This project is independently developed
> by the community and is not endorsed by or affiliated with the Government of Alberta.
> Implementation, configuration, hosting, and operational controls are the responsibility
> of the deploying organization. Deploying agencies are responsible for ensuring their
> specific deployment meets all applicable regulatory and privacy obligations.

## Quick Start

```bash
# Setup the project
./setup.sh

# Run all services in development
pnpm dev:all

# Run tests
pnpm test          # Unit tests
pnpm test:e2e      # E2E tests (in Docker container)
```

## Available Scripts

### Development

- `pnpm dev` - Start all development servers
- `pnpm dev:all` - Start API, Inspector PWA, and Admin Portal
- `pnpm api:dev` - Start API server only
- `pnpm inspector:dev` - Start Inspector PWA only
- `pnpm admin:dev` - Start Admin Portal only

### Testing

- `pnpm test` - Run all unit tests
- `pnpm test:unit` - Run unit tests
- `pnpm test:integration` - Run integration tests
- `pnpm test:e2e` - Run E2E tests in Docker container (builds container)
- `pnpm test:e2e:quick` - Run E2E tests without rebuilding container
- `pnpm test:e2e:debug` - Run E2E tests with container kept running for debugging
- `pnpm test:e2e:auth` - Run only authentication-related E2E tests

### Building

- `pnpm build` - Build all packages
- `pnpm build:api` - Build API only
- `pnpm build:inspector` - Build Inspector PWA only
- `pnpm build:admin` - Build Admin Portal only

### Database

- `pnpm db:generate` - Generate Prisma client
- `pnpm db:migrate` - Run database migrations
- `pnpm db:seed` - Seed database with test data
- `pnpm db:studio` - Open Prisma Studio

### Code Quality

- `pnpm lint` - Run ESLint
- `pnpm lint:fix` - Fix ESLint issues
- `pnpm format` - Format code with Prettier
- `pnpm format:check` - Check code formatting
- `pnpm typecheck` - Run TypeScript type checking

## E2E Testing

E2E tests run in a Docker container that includes:

- PostgreSQL database
- Hono API server
- Inspector PWA (Vite preview)
- Admin Portal (Vite preview)
- Playwright browser automation

### Running E2E Tests

```bash
# Run all E2E tests (builds container first)
pnpm test:e2e

# Run tests without rebuilding (faster for development)
pnpm test:e2e:quick

# Run only authentication tests
pnpm test:e2e:auth

# Debug mode - keep container running after tests
pnpm test:e2e:debug
```

### E2E Test Results

Test results are automatically saved to `./test-results/`:

- `cucumber-report.html` - Visual test report (open in browser)
- `cucumber-report.json` - Detailed test data
- `screenshots/` - Screenshots of failed tests
- `traces/` - Playwright execution traces

```bash
# View test results
./scripts/view-e2e-results.sh
open test-results/cucumber-report.html
```

## Architecture

### Monorepo Structure

```
├── apps/
│   ├── api/          # Hono API server
│   ├── inspector/    # Vue 3 PWA for inspectors
│   └── admin/        # Vue 3 admin portal
├── packages/
│   ├── db/           # Prisma database schema
│   ├── ui/           # Shared UI components
│   ├── utils/        # Shared utilities
│   ├── validators/   # Zod validation schemas
│   ├── contracts/    # TypeScript contracts
│   └── e2e-tests/    # End-to-end tests
```

### Tech Stack

- **Backend**: Hono (Node.js), Prisma, PostgreSQL
- **Frontend**: Vue 3, Vite, Tailwind CSS, Pinia, TanStack Query
- **Testing**: Vitest, Playwright, Cucumber
- **Build**: Turborepo, pnpm workspaces
- **Deployment**: Docker, Render.com

## Development Setup

1. **Prerequisites**
   - Node.js 20+
   - pnpm 9+
   - Docker (for E2E tests)

2. **Clone and setup**

   ```bash
   git clone <repository>
   cd inspections-monorepo
   ./setup.sh
   ```

3. **Install Git hooks** (recommended)

   ```bash
   ./scripts/setup-git-hooks.sh
   ```

   This installs a pre-push hook that runs checks before pushing to `develop` or `main`:
   - Type checking
   - Linting
   - Format checking
   - Build verification
   - Unit & integration tests

4. **Start development**

   ```bash
   pnpm dev:all
   ```

5. **Run tests**
   ```bash
   pnpm test
   pnpm test:e2e
   ```

## Ports

| Service       | Development | E2E Tests | Production |
| ------------- | ----------- | --------- | ---------- |
| API           | 4000        | 4000      | 3002       |
| Inspector PWA | 5175        | 5175      | 8080       |
| Admin Portal  | 5174        | 5174      | 8081       |
| PostgreSQL    | 5432        | 5432      | -          |

## CI/CD Pipeline

### Branch-Specific Testing Strategy

**Main Branch (Production):**

- ✅ Unit tests
- ✅ Integration tests
- ✅ E2E tests (full stack testing)
- ✅ Build verification

**Develop Branch (Staging):**

- ✅ Unit tests
- ✅ Integration tests
- ❌ E2E tests (skip for faster feedback)

**Why this approach:**

- E2E tests are slow and expensive (~5-10 minutes)
- Unit/integration tests catch most issues
- E2E tests run on main for production readiness
- Faster CI feedback on develop branch

### Development Workflow

1. **Feature Development**

   ```bash
   git checkout develop
   git checkout -b feature/new-feature
   # Make changes...
   ```

2. **Pull Request to develop**
   - CI runs: unit + integration tests (~2-3 minutes)
   - Fast feedback for development iteration

3. **Merge to develop**
   - Deploys to staging environment
   - QA testing on staging

4. **Pull Request to main**
   - CI runs: unit + integration + E2E tests (~7-12 minutes)
   - Full validation before production

5. **Merge to main**
   - Deploys to production with approval gates

## Staging deployment (Render.com)

Deploy the full stack to [Render](https://render.com): **PostgreSQL**, **API** (Web Service), **Inspector PWA** and **Admin** (Static Sites). The Inspector static site alone cannot authenticate users without the API and database.

**Canonical guide:** [`_docs/internal/development/02-initial-setup/render-deployment-checklist.md`](_docs/internal/development/02-initial-setup/render-deployment-checklist.md) — setup order, env vars, migrations, seed data, login troubleshooting, SSO notes.

Staging maps to the `develop` branch. CI/CD and branch mapping: [`_docs/internal/development/01-governance/ci-cd-guide.md`](_docs/internal/development/01-governance/ci-cd-guide.md).

### Prerequisites

- Render account connected to this GitHub repository (`develop` branch deploys).
- Cloudflare account if you use **R2** for documents/photos in staging (recommended to match production).

### URL alignment (login will fail without this)

| Set on                         | Variable        | Example                                      |
| ------------------------------ | --------------- | -------------------------------------------- |
| API                            | `INSPECTOR_URL` | `https://inspector-pwa-staging.onrender.com` |
| API                            | `ADMIN_URL`     | `https://admin-portal-staging.onrender.com`  |
| Inspector + Admin (build-time) | `VITE_API_URL`  | `https://sci-api-staging.onrender.com`       |

Redeploy Inspector/Admin after any `VITE_*` change. Match origins exactly (no trailing slash).

### 1. PostgreSQL (staging)

1. In Render: **New** → **PostgreSQL**.
2. Create a database (for example name `inspections-db-staging`).
3. After it is provisioned, open the database → copy the **Internal Database URL** (`postgresql://…`). Use this as `DATABASE_URL` on the API service only (internal URL keeps traffic on Render’s network).

### 2. API — Web Service (staging)

1. **New** → **Web Service** → select this repository.
2. **Branch:** `develop`.
3. **Root Directory:** leave **empty** (build from monorepo root so workspace packages resolve).
4. **Runtime:** **Docker**.
5. **Dockerfile Path:** `apps/api/Dockerfile`.
6. **Docker build context:** repository root (default when root directory is empty).
7. **Instance type / region:** per your team; enable **Auto-Deploy** on `develop` if you want pushes to deploy without a manual hook.
8. **Health Check Path:** `/health`.

**Environment variables (API)**

Set at least the following on the **staging API** service (names match [`apps/api/.env.example`](apps/api/.env.example)):

| Variable                     | Purpose                                                                     |
| ---------------------------- | --------------------------------------------------------------------------- |
| `DATABASE_URL`               | Internal PostgreSQL URL from step 1                                         |
| `JWT_SECRET`                 | Strong secret (≥ 32 characters; unique per environment)                     |
| `NODE_ENV`                   | `staging` (convention)                                                      |
| `INSPECTOR_URL`              | Public URL of the staging Inspector static site (CORS + OpenAPI)            |
| `ADMIN_URL`                  | Public URL of the staging Admin static site                                 |
| `EXTRA_CORS_ORIGINS`         | Optional comma-separated additional trusted browser origins; no wildcards   |
| `JWT_EXPIRES_IN`             | Optional; default `15m` in code                                             |
| `JWT_REFRESH_EXPIRES_IN`     | Optional; default `7d` in code                                              |
| `OFFLINE_GRACE_PERIOD_HOURS` | Optional                                                                    |
| `AUTO_LOGOUT_IDLE_MINUTES`   | Optional                                                                    |
| `VAPID_PUBLIC_KEY`           | Web Push public key (see [Web Push](#web-push-notifications-staging) below) |
| `VAPID_PRIVATE_KEY`          | Web Push private key — **API only**, never on static sites                  |
| `VAPID_SUBJECT`              | Optional; `mailto:…` contact for push provider (default in code)            |

Render injects **`PORT`**; the API listens on `process.env.PORT`.

**Database migrations and seed**

Apply migrations before first login. From your machine (Render Postgres **External** URL):

```bash
DATABASE_URL="postgresql://…" pnpm --filter @codecomply/db migrate:deploy
```

For staging demos, seed development users and sample data once:

```bash
DATABASE_URL="postgresql://…" pnpm db:seed
```

See the [Render checklist](_docs/internal/development/02-initial-setup/render-deployment-checklist.md#database-migrations-and-seed-data) for Shell/pre-deploy options.

**Sign-in after deploy (seeded staging):**

| App           | Email                    | Password      |
| ------------- | ------------------------ | ------------- |
| Inspector PWA | `inspector1@example.com` | `password123` |
| Admin portal  | `admin@example.com`      | `admin123`    |

Do not use the admin account on the Inspector app (SCO role required).

### 3. Inspector PWA — Static Site (staging)

1. **New** → **Static Site** → same repository, branch **`develop`**.
2. **Root Directory:** empty (monorepo root).
3. **Build command** (pnpm must be available — enable Corepack on Render or install pnpm first):

   ```bash
   corepack enable && corepack prepare pnpm@9.0.0 --activate && pnpm install --frozen-lockfile && pnpm build:inspector
   ```

4. **Publish directory:** `apps/inspector/dist`.
5. **Environment variables:**

   | Variable                | Value                                                                                                   |
   | ----------------------- | ------------------------------------------------------------------------------------------------------- |
   | `VITE_API_URL`          | Public HTTPS URL of the staging API (no trailing slash), e.g. `https://<your-api-service>.onrender.com` |
   | `VITE_VAPID_PUBLIC_KEY` | Same value as API `VAPID_PUBLIC_KEY` (see [Web Push](#web-push-notifications-staging) below)            |

`VITE_*` variables are baked in at **build** time; redeploy the static site after changing them.

Production Inspector/Admin static sites on Render use the same variables with **production** API URLs and **production** VAPID keys (generate a separate key pair per environment).

### 4. Admin Portal — Static Site (staging)

Same as Inspector, with:

- **Build command:**

  ```bash
  corepack enable && corepack prepare pnpm@9.0.0 --activate && pnpm install --frozen-lockfile && pnpm build:admin
  ```

- **Publish directory:** `apps/admin/dist`.
- **Environment variable:** `VITE_API_URL` = same staging API URL as Inspector.

### 5. GitHub Actions — deploy hooks (optional)

The workflow [`.github/workflows/deploy-staging.yml`](.github/workflows/deploy-staging.yml) waits for the **Unit & Integration Tests** check, then POSTs Render **deploy hooks** so staging refreshes after CI passes.

In GitHub: **Settings** → **Secrets and variables** → **Actions** → add:

| Secret                          | Source                                                     |
| ------------------------------- | ---------------------------------------------------------- |
| `RENDER_API_STAGING_HOOK`       | Render → API service → **Manual Deploy** → **Deploy Hook** |
| `RENDER_INSPECTOR_STAGING_HOOK` | Deploy hook URL for Inspector static site                  |
| `RENDER_ADMIN_STAGING_HOOK`     | Deploy hook URL for Admin static site                      |

If these secrets are unset, rely on Render’s auto-deploy from `develop` instead.

### Web Push notifications (staging)

Web Push (NFR-M-04) lets the Inspector PWA receive assignment updates when installed. Render’s HTTPS endpoints satisfy browser requirements; no extra Render add-on is needed.

#### 1. Generate VAPID keys (once per environment)

From the repo root:

```bash
pnpm --filter @codecomply/api exec web-push generate-vapid-keys
```

Copy the **public** and **private** keys. Use **different** key pairs for staging and production.

#### 2. API — Render environment variables

On the **staging API** Web Service, add:

| Variable            | Value                                  |
| ------------------- | -------------------------------------- |
| `VAPID_PUBLIC_KEY`  | Public key from step 1                 |
| `VAPID_PRIVATE_KEY` | Private key from step 1                |
| `VAPID_SUBJECT`     | e.g. `mailto:ops@your-org.example.com` |

If either `VAPID_PUBLIC_KEY` or `VAPID_PRIVATE_KEY` is missing, `/api/notifications/subscribe` returns **503** and pushes are skipped (assignments still work).

Ensure migrations are applied so `device_push_subscriptions` exists (included in normal `migrate:deploy` on deploy).

#### 3. Inspector — Render environment variable

On the **staging Inspector** static site, add at build time:

| Variable                | Value                                        |
| ----------------------- | -------------------------------------------- |
| `VITE_VAPID_PUBLIC_KEY` | Same string as `VAPID_PUBLIC_KEY` on the API |

Redeploy the Inspector static site after setting or changing this variable (Vite inlines it at build).

#### 4. Post-deploy verification

1. Open the staging Inspector URL over **HTTPS**, sign in as an SCO test user.
2. On **Home** or **Profile**, tap **Enable notifications** and allow the browser prompt.
3. Confirm subscribe succeeds (no 503 in network tab for `POST …/api/notifications/subscribe`).
4. **Admin test (optional):** sign in to staging Admin as an admin, call `POST /api/notifications/test` with a bearer token (or use Swagger on the API) targeting the SCO user id; a notification should appear when the Inspector PWA is in the background or closed.
5. **Assignment flow:** create or assign an inspection to that user from Admin; a push should fire if the user has an active subscription.

**iOS:** Web Push works only when the PWA is **added to the home screen** on **iOS 16.4+**. In a normal Safari tab, push controls are hidden automatically.

**Security:** never set `VAPID_PRIVATE_KEY` or `VITE_VAPID_PUBLIC_KEY` on the Admin static site unless you intentionally expose the public key there; only the Inspector client needs the public key.

See also [`apps/inspector/README.md`](apps/inspector/README.md) for local push development (`dev:push`).

---

## Cloudflare R2 (staging)

The API uses **one S3-compatible client** for both local MinIO and Cloudflare R2 (`R2_*` environment variables; see [`apps/api/src/lib/storage/storage-client.ts`](apps/api/src/lib/storage/storage-client.ts)). Staging uses **R2** when the API’s `R2_ENDPOINT` points at Cloudflare.

### 1. Create buckets

1. Cloudflare Dashboard → **R2** → **Create bucket**.
2. Create buckets for photos and documents (defaults in code / env): for example **`inspection-photos`** and **`inspection-documents`**, or names you prefer if you override env vars below.

### 2. API token (S3-compatible credentials)

These are **R2-specific** S3 keys — not the same as **My Profile → API Tokens** (Workers/general Cloudflare API tokens). Follow [Cloudflare R2: Authentication (S3 API tokens)](https://developers.cloudflare.com/r2/api/s3/tokens/).

1. Open the **R2** product in the dashboard: **R2** in the left sidebar (or use **Workers & Pages** → **R2** depending on layout), then open the **Overview** page for object storage — direct pattern: `https://dash.cloudflare.com/?to=/:account/r2/overview` (replace with your account).
2. On the R2 **Overview** page, find the **Account details** section (not an individual bucket). Next to **API Tokens**, click **Manage**.
3. Create either an **Account API token** (any authorized system; only **Super Administrator** can create these) or a **User API token** (tied to your user). For app credentials, **Object Read & Write** scoped to `inspection-photos` and `inspection-documents` (or your bucket names) is usually enough.
4. On the success screen, copy **Access Key ID** and **Secret Access Key** immediately — you cannot view the secret again. They map to `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY`.

**If you do not see Account details / Manage next to API Tokens:**

- **R2 must be enabled on the account** — Cloudflare documents that you **cannot generate R2 API tokens until R2 is purchased/enabled** for that account ([same docs](https://developers.cloudflare.com/r2/api/s3/tokens/)).
- Confirm you are on **R2 Overview**, not inside a single bucket’s settings (bucket pages list objects and bucket options; token management stays on the overview / account-details area).
- **Account API tokens** require Super Administrator; try **Create User API token** if your role cannot create account tokens.

### 3. S3 API endpoint

In the R2 bucket or account UI, note the **S3 API** endpoint for your account, in the form:

`https://<account_id>.r2.cloudflarestorage.com`

Use that full URL as **`R2_ENDPOINT`** on the **staging API** service on Render (not on the static sites).

### 4. Environment variables on Render (API staging only)

Add to the **API** Web Service:

| Variable               | Example / notes                                      |
| ---------------------- | ---------------------------------------------------- |
| `R2_ENDPOINT`          | `https://<account_id>.r2.cloudflarestorage.com`      |
| `R2_ACCESS_KEY_ID`     | From R2 API token                                    |
| `R2_SECRET_ACCESS_KEY` | From R2 API token                                    |
| `R2_BUCKET_PHOTOS`     | `inspection-photos` (or your bucket name)            |
| `R2_BUCKET_DOCUMENTS`  | `inspection-documents` (or your bucket name)         |
| `R2_REGION`            | `auto` (matches Cloudflare R2 defaults used in code) |

**Path-style addressing:** For R2 you normally **omit** `R2_FORCE_PATH_STYLE`. The app sets path-style automatically for local MinIO (`localhost`, `127.0.0.1`, or `minio` in the endpoint). Only set `R2_FORCE_PATH_STYLE=true` if Cloudflare support or logs indicate it is required.

Local development continues to use **MinIO** via [`docker-compose.yml`](docker-compose.yml); staging/production use **R2** by pointing `R2_ENDPOINT` and credentials at Cloudflare instead of MinIO.

## Contributing

1. Create a feature branch from `develop`
2. Write tests for new functionality
3. Ensure unit/integration tests pass: `pnpm test`
4. Submit a pull request to `develop`
5. After merge to `develop`, create PR to `main` for production deployment

## License

[License information]
