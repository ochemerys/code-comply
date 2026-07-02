# CodeComply Connect — API Reference

Milestone **M11-S22** — Complete API documentation with OpenAPI 3.0.

## Quick links

| Resource                     | Location                                               |
| ---------------------------- | ------------------------------------------------------ |
| OpenAPI YAML (static export) | [`apps/api/openapi.yaml`](../../apps/api/openapi.yaml) |
| Live OpenAPI JSON            | `GET /openapi.json` on the API server                  |
| Swagger UI                   | `GET /swagger` on the API server                       |
| Export script                | `node scripts/export-openapi.mjs`                      |
| Audit script                 | `node scripts/openapi-audit.mjs`                       |

**Local base URL:** `http://localhost:4000`

---

## Authentication

All routes under `/api/*` require a valid JWT unless noted otherwise. Public routes: `/health`, `/auth/login`, `/auth/refresh`.

### Login

```http
POST /auth/login
Content-Type: application/json

{
  "email": "inspector@example.com",
  "password": "password123"
}
```

**200 response example:**

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.access",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.refresh",
  "expiresIn": 3600
}
```

### Bearer token

Send the access token on protected requests:

```http
Authorization: Bearer <accessToken>
```

### Refresh

```http
POST /auth/refresh
Content-Type: application/json

{ "refreshToken": "<refreshToken>" }
```

### Current user

```http
GET /auth/me
Authorization: Bearer <accessToken>
```

### Logout

```http
POST /auth/logout
Authorization: Bearer <accessToken>
```

---

## Inspections

| Method | Path                              | Description                                      |
| ------ | --------------------------------- | ------------------------------------------------ |
| GET    | `/api/inspections/`               | List inspections for the authenticated inspector |
| GET    | `/api/inspections/{id}`           | Get inspection detail                            |
| POST   | `/api/inspections/{id}/start`     | Start an scheduled inspection                    |
| POST   | `/api/inspections/{id}/finalize`  | Finalize and submit inspection                   |
| GET    | `/api/inspections/{id}/documents` | List documents attached to inspection            |
| GET    | `/api/inspections/{id}/reports`   | List generated PDF reports                       |

**Example — start inspection:**

```http
POST /api/inspections/insp-123/start
Authorization: Bearer <accessToken>
```

Related: **Permits** (`/api/permits/assigned`), **Checklists** (`/api/checklists/executions`), **Sync** (`/api/sync/push`, `/api/sync/pull`) for offline-first workflows.

---

## Deficiencies

| Method | Path                               | Description                                                           |
| ------ | ---------------------------------- | --------------------------------------------------------------------- |
| GET    | `/api/deficiencies/`               | List deficiencies (filter by `inspectionId`, `status`)                |
| POST   | `/api/deficiencies/`               | Create deficiency (supports client-side deduplication via `clientId`) |
| GET    | `/api/deficiencies/{id}`           | Get deficiency detail                                                 |
| PATCH  | `/api/deficiencies/{id}`           | Update deficiency (requires `If-Match` ETag header)                   |
| DELETE | `/api/deficiencies/{id}`           | Delete deficiency                                                     |
| POST   | `/api/deficiencies/{id}/voc`       | Submit Verification of Compliance                                     |
| POST   | `/api/deficiencies/{id}/stop-work` | Issue Stop Work order                                                 |

**Example — create deficiency:**

```http
POST /api/deficiencies/
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "clientId": "client-def-001",
  "inspectionId": "insp-123",
  "description": "Missing fire separation at duct penetration",
  "severity": "MAJOR",
  "location": "Mechanical room"
}
```

---

## Documents

| Method | Path                      | Description                                                  |
| ------ | ------------------------- | ------------------------------------------------------------ |
| POST   | `/api/documents/`         | Multipart upload (`file`, `inspectionId`, optional metadata) |
| GET    | `/api/documents/{id}/url` | Signed download URL (time-limited)                           |
| DELETE | `/api/documents/{id}`     | Delete document and storage object                           |

**Example — upload:**

```http
POST /api/documents/
Authorization: Bearer <accessToken>
Content-Type: multipart/form-data

file=<binary>
inspectionId=insp-123
title=Site plan
category=PLAN
```

**Photos** use `/api/photos/` with the same Bearer auth and multipart pattern (`file`, `clientId`, `inspectionId`).

---

## Reports

| Method | Path                         | Description                           |
| ------ | ---------------------------- | ------------------------------------- |
| POST   | `/api/reports/generate`      | Generate PDF report for an inspection |
| GET    | `/api/reports/{id}/download` | Signed URL to download stored PDF     |

**VoC (Verification of Compliance)** admin queue: `GET /api/voc/pending`, `POST /api/voc/{id}/review`.

---

## Admin

Requires `ADMIN` role and route-specific permissions.

| Method | Path                                   | Description                  |
| ------ | -------------------------------------- | ---------------------------- |
| GET    | `/api/admin/users/`                    | List users                   |
| GET    | `/api/admin/users/{id}`                | User detail                  |
| PATCH  | `/api/admin/users/{id}`                | Update user profile          |
| POST   | `/api/admin/users/{id}/certifications` | Add certification            |
| POST   | `/api/admin/users/{id}/deactivate`     | Deactivate user              |
| POST   | `/api/admin/assignments/`              | Create inspection assignment |
| POST   | `/api/admin/assignments/bulk`          | Bulk assign inspections      |
| GET    | `/api/admin/assignments/workload`      | Inspector workload summary   |
| GET    | `/api/admin/compliance-search/`        | Search compliance records    |

---

## Error responses

Errors return JSON: `{ "error": "<message>", "message": "<optional detail>" }`.

| HTTP    | Meaning               | Typical cause                                   |
| ------- | --------------------- | ----------------------------------------------- |
| **400** | Bad Request           | Invalid body, query, or multipart fields        |
| **401** | Unauthorized          | Missing or invalid Bearer token                 |
| **403** | Forbidden             | Valid token but insufficient role or assignment |
| **404** | Not Found             | Resource does not exist                         |
| **409** | Conflict              | ETag mismatch on PATCH (optimistic concurrency) |
| **413** | Payload Too Large     | Upload exceeds size limit                       |
| **429** | Too Many Requests     | Rate limit exceeded (see middleware)            |
| **500** | Internal Server Error | Unhandled server error                          |
| **503** | Service Unavailable   | Health check — database disconnected            |

---

## Sync (offline-first)

| Method | Path             | Description                      |
| ------ | ---------------- | -------------------------------- |
| POST   | `/api/sync/push` | Push queued offline mutations    |
| GET    | `/api/sync/pull` | Pull server changes since cursor |

---

## Health

```http
GET /health/
```

Returns `{ "status": "ok", "timestamp": "...", "database": "connected" }` or **503** when the database is unreachable.

---

## Maintaining documentation

1. Define routes with `@hono/zod-openapi` `createRoute` in `apps/api/src/routes/`.
2. Add request/response `example` blocks where helpful.
3. Re-export: `node scripts/export-openapi.mjs`
4. Verify: `pnpm --filter @codecomply/api test openapi` and `node scripts/openapi-audit.mjs`

See also: [`m11-s22-api-documentation-checklist.md`](../internal/development/03-implementation/m11-s22-api-documentation-checklist.md).
