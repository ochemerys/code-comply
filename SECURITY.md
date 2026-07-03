# Security Policy

> **Status: DRAFT.** This vulnerability disclosure policy is an early draft for the
> CodeComply open source project. Contact details, timelines, and supported-version
> commitments are provisional and will be finalized before the first public release.
> See [Part 4 of the branding & strategy guide](_docs/branding/branding-guide.md#5-part-4-open-source-specific-branding--community-elements)
> for the intended security posture.

CodeComply is open source inspection management software designed to support workflows
under Alberta's Safety Codes Act and FOIP. Because agencies handle personal and
regulatory information, a clear and verifiable security process is a core part of the
project. The open source codebase is auditable by anyone — we treat that transparency as
a security strength.

## Reporting a Vulnerability

**Please do not open a public issue for security vulnerabilities.**

Report suspected vulnerabilities privately:

- Preferred: GitHub private vulnerability reporting (Security → "Report a vulnerability")
  once the repository is published.
- Email (interim, draft): `security@codecomply.example` — **placeholder; replace with the
  project's monitored security contact before public launch.**

When reporting, please include where possible:

- A description of the issue and its potential impact.
- Steps to reproduce (proof of concept, affected endpoints/components).
- Affected version, commit, or deployment configuration.
- Any suggested remediation.

Please give us a reasonable opportunity to investigate and remediate before any public
disclosure (coordinated disclosure).

## Response Targets (Draft)

These targets are provisional for the community edition and are not a contractual SLA.
SLA-backed response times are available through CodeComply Support for agencies that
require contractual commitments.

| Stage                     | Target (draft)                                          |
| ------------------------- | ------------------------------------------------------- |
| Acknowledge report        | Within 3 business days                                  |
| Initial assessment        | Within 10 business days                                 |
| Fix or mitigation plan    | Severity-dependent; communicated to reporter            |
| Public advisory / release | After a fix is available, coordinated with the reporter |

## Supported Versions

CodeComply is under active development and has not yet reached a public 1.0 release.
Until a long-term support (LTS) policy is published, security fixes target the latest
`main` and `develop` branches only. An LTS / supported-version matrix is a planned
follow-up (see the branding guide, Part 5–6).

| Version            | Supported |
| ------------------ | --------- |
| `main` (latest)    | ✅ Yes    |
| `develop` (latest) | ✅ Yes    |
| Older snapshots    | ❌ No     |

## Dependency & Supply-Chain Management

- Dependencies are pinned via the committed `pnpm-lock.yaml` lockfile.
- Automated dependency update tooling (Dependabot or Renovate) is **recommended and
  planned** but not yet enabled.
- A Software Bill of Materials (SBOM) is **to be published**.
- Release signing and verified builds are **to be implemented**.

## Deployment Hardening & Compliance

Implementation, configuration, hosting, and operational controls are the responsibility
of the deploying organization. Security and privacy outcomes are
**implementation-dependent**. Deploying agencies should review:

- [`REGULATORY.md`](REGULATORY.md) — regulatory alignment and compliance mapping.
- [`_docs/internal/operations/runbook.md`](_docs/internal/operations/runbook.md) — operations and monitoring.
- [`_docs/internal/operations/incident-response.md`](_docs/internal/operations/incident-response.md) — incident handling.
- [Staging deployment (Render.com)](README.md#staging-deployment-rendercom) — deployment configuration, including Canadian-region hosting guidance for FOIP alignment.

## No Warranty

CodeComply is provided under the [MIT License](LICENSE) "as is", without warranty of any
kind. This project is independently developed by the community and is **not endorsed by or
affiliated with the Government of Alberta**.
