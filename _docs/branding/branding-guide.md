# **CodeComply** — _Open source inspection management aligned to Alberta Safety Codes_

**Open Source Inspection Management System**  
Built for Agencies — Supported by Community

---

## Table of Contents

1. [Preamble: Open Source Context](#1-preamble-open-source-context)
2. [Part 1: Naming the Whole System (Master Project Brand)](#2-part-1-naming-the-whole-system-master-project-brand)
3. [Part 2: Application & Repository Branding](#3-part-2-application--repository-branding)
4. [Part 3: Demonstrating Alberta Regulatory Alignment](#4-part-3-demonstrating-alberta-regulatory-alignment)
5. [Part 4: Open Source Specific Branding & Community Elements](#5-part-4-open-source-specific-branding--community-elements)
6. [Part 5: Final Recommended Branding Package](#6-part-5-final-recommended-branding-package)
7. [Part 6: Critical Next Steps](#7-part-6-critical-next-steps)

---

## 1. Preamble: Open Source Context

This system is released as open source software. The primary goal is to provide agencies — municipalities, accredited inspection agencies, and other inspection bodies operating under Alberta's regulatory framework — with a transparent, community-supported inspection management platform they can adopt, audit, modify, and deploy with confidence.

Because the code is open source:

- **There is no vendor lock-in.** Agencies can self-host, fork, or extend the system.
- **Transparency replaces trust claims.** Anyone can audit the codebase for security, privacy, and regulatory alignment.
- **Community contribution is expected.** Agencies, developers, and consultants can submit improvements, regulatory updates, and integrations.
- **Support is the primary service offering.** While the code is free, professional support, deployment assistance, managed hosting, training, and compliance consulting form the sustainable business and community engagement model.

This strategy document is written with that model in mind. Every branding, compliance, and documentation recommendation below reflects the reality that agencies are both the primary users and potential contributors, and that open source support services are the core offering.

### Current Project State

| Aspect               | Current value                                    | Target (this guide)                                                                                |
| -------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| Repository           | `inspections-monorepo`                           | Retain or rename to `codecomply/core` when publishing publicly                                     |
| Working product name | Safety Codes Inspection System                   | CodeComply (Alberta Safety Codes Inspections Management System)                                    |
| Package scope        | `@acme/`\*                                       | `@codecomply/*` (when brand is finalized)                                                          |
| License              | Not yet declared (see [README](../../README.md)) | Apache 2.0 recommended (see [Part 4](#5-part-4-open-source-specific-branding--community-elements)) |

---

## 2. Part 1: Naming the Whole System (Master Project Brand)

Your umbrella name should communicate inspections + compliance + trust while being professional enough for municipal and agency procurement, modern enough for broad adoption, and clearly identifiable as an open source community project rather than a proprietary product.

**Critically, the name must not imply Government of Alberta endorsement unless you have formal authorization.**

### Recommended Naming Directions

#### Direction A: Authoritative & Descriptive (Best for Agency Adoption)

- **CodeComply** — _Alberta Safety Codes Inspections Management System_  
  Open source inspection management aligned to Alberta Safety Codes.

#### Direction B: Community-Oriented & OSS-Signaling

- **OpenInspect** or **CivicInspect** — Open source inspection workflows built for public bodies.

#### Direction C: Core Infrastructure

- **OpenComply** — Open source compliance-aligned inspection management for agencies.

### Avoid

Names implying official status:

- AlbertaInspect
- GovInspect
- Alberta Safety Core
- Official Safety Codes Platform

### Recommendation

**Use CodeComply as the master brand** and always pair it with the descriptor "open source" in taglines, documentation headers, and repository descriptions. This aligns with the project's planned branding direction and the Alberta Safety Codes domain while keeping the open source nature unmistakable.

The interim descriptive name **Safety Codes Inspection System** (used throughout the codebase today) should be replaced progressively in UI, PDF templates, and documentation as CodeComply branding is applied.

For the remainder of this document, **CodeComply** is used as the example master brand.

---

## 3. Part 2: Application & Repository Branding

Use a consistent **Master Brand + Descriptor** naming convention. For open source, clarity matters more than marketing flair — names must make sense for both non-technical agency directors and the developers deploying the code.

### Recommended Architecture (This Monorepo)

| Component        | Public / Marketing Name | Repository / Package Name                                                                                  | Monorepo Path    | Description                                                    |
| ---------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------- | -------------------------------------------------------------- |
| Master Project   | CodeComply              | `inspections-monorepo` / `@codecomply/`\*                                                                  | Repository root  | The open source inspection management system                   |
| Mobile PWA       | CodeComply Field        | `@codecomply/inspector`                                                                                    | `apps/inspector` | Offline-capable field inspections for SCOs                     |
| Admin Portal     | CodeComply Admin        | `@codecomply/admin`                                                                                        | `apps/admin`     | Assignments, monitoring, reporting, compliance                 |
| API Layer        | CodeComply Connect      | `@codecomply/api`                                                                                          | `apps/api`       | REST API — integrations (GIS, permitting, identity, reporting) |
| Shared Packages  | —                       | `@codecomply/db`, `@codecomply/ui`, `@codecomply/utils`, `@codecomply/validators`, `@codecomply/contracts` | `packages/*`     | Database schema, UI components, validation, contracts          |
| Documentation    | CodeComply Docs         | —                                                                                                          | `_docs/`         | Community and agency documentation hub                         |
| Support Services | CodeComply Support      | (not a repo — a service brand)                                                                             | —                | Professional services for agencies deploying CodeComply        |

### Alternative Naming Patterns

| Pattern             | Mobile PWA           | Admin Portal              |
| ------------------- | -------------------- | ------------------------- |
| Umbrella + Role     | CodeComply Inspector | CodeComply Admin          |
| Umbrella + Function | CodeComply Field     | CodeComply Control Center |
| Umbrella + Action   | CodeComply Go        | CodeComply Hub            |
| Umbrella + Location | CodeComply OnSite    | CodeComply Desk           |

**Recommendation:** "Umbrella + Role" or "Umbrella + Function" patterns work best. They are immediately understandable, professional, and scalable. As the community grows, additional modules follow the same convention naturally:

- **CodeComply Applicant Portal** — public-facing permit/inspection request interface
- **CodeComply Reports** — analytics and regulatory reporting module

### Commercial Support Branding (Monetization Layer)

To differentiate the free open source code from paid services, establish a clear distinction:

| Layer                  | Brand                                    | Description                                                                      |
| ---------------------- | ---------------------------------------- | -------------------------------------------------------------------------------- |
| Open Source            | CodeComply                               | Free forever under the chosen license                                            |
| Paid Support / Hosting | CodeComply Support or CodeComply Managed | Agencies pay for implementation, hosting, maintenance, and compliance consulting |

### Brand Architecture Diagram

```
CodeComply
Open Source Inspection Management System
│
├── CodeComply Field      (PWA — apps/inspector — for SCOs)
├── CodeComply Admin      (Web Portal — apps/admin — for Administrators)
├── CodeComply Connect    (API — apps/api — for Integrations)
├── CodeComply Docs       (Documentation — _docs/ — for Agencies & Contributors)
└── CodeComply Support    (Professional Services — for Agency Deployment)
```

---

## 4. Part 3: Demonstrating Alberta Regulatory Alignment

This is the most critical part of the strategy — especially for an open source project targeting agencies. Agencies need to trust that the system supports their regulatory obligations. Because the code is open, the system's compliance posture is verifiable by anyone, which is a significant advantage over proprietary alternatives. However, claims must still be precise and honest.

### The Golden Rule: "Supports / Aligned With" — Not "Certified By"

Use phrasing like:

- ✅ "Designed to support workflows under Alberta's Safety Codes Act"
- ✅ "FOIP-aligned data handling and privacy controls — auditable in the open source codebase"
- ✅ "Supports creation and retention of Notice of Compliance documentation"
- ✅ "Provides features that help public bodies meet FOIP obligations (implementation-dependent)"
- ✅ "Open source transparency enables agencies to verify regulatory alignment directly"

Avoid:

- ❌ "100% FOIP Compliant" (FOIP compliance is ultimately the public body's responsibility and requires their own PIA/processes)
- ❌ "Government Approved" or "Certified by Alberta"
- ❌ "Official Alberta Safety Codes Platform"
- ❌ "Guaranteed compliant" (no software can guarantee compliance — compliance is an organizational responsibility that software supports)

**Why this matters:** FOIP applies primarily to public bodies. Vendors and open source projects support a public body's FOIP obligations — they do not independently become "FOIP compliant." Overclaiming creates legal risk and erodes credibility with knowledgeable procurement teams. The open source model actually strengthens your position here: agencies can audit the code themselves to verify that privacy and security claims are substantiated. Lean into this advantage rather than making unverifiable marketing claims.

**Critical for open source:** Because agencies may modify, configure, or deploy the system in varying ways, the project cannot guarantee that every deployment is compliant — only that the base system is designed to support compliance. Compliance is always implementation-dependent.

### A. Compliance + Open Source Disclosure Statement (Legal Footer)

Place this in the application footer, About page, login screen, repository README, and all documentation:

> CodeComply is an open source inspection management system designed and developed to support workflows under the Alberta Safety Codes Act (RSA 2000, c. S-1), the Freedom of Information and Protection of Privacy Act (RSA 2000, c. F-25), and Safety Codes Inspection Notice of Compliance requirements. This project is independently developed by the community and is not endorsed by or affiliated with the Government of Alberta. Implementation, configuration, hosting, and operational controls are the responsibility of the deploying organization. Deploying agencies are responsible for ensuring their specific deployment meets all applicable regulatory and privacy obligations.

_(Optionally add: "See SECURITY.md and the Hardening Guide for recommended deployment configurations.")_

**Current implementation note:** The Admin Portal footer currently displays "Safety Codes Inspection System" (`apps/admin/src/components/AppFooter.vue`). Update to the CodeComply disclosure statement when branding is applied.

### B. Trust & Compliance Page (Website, Repository Wiki, Portal)

Create a dedicated **Regulatory Alignment** or **Trust & Compliance** page. For an open source project, this page serves double duty: it informs prospective agency adopters and guides contributors on the regulatory context their code must respect.

Related existing documentation:

- `[_docs/requirements/alberta-safety-codes-compliance-guide.md](../requirements/alberta-safety-codes-compliance-guide.md)` — statutory framework and technical compliance mapping
- `[_docs/requirements/safety-codes-inspection-notice-of-compliance.md](../requirements/safety-codes-inspection-notice-of-compliance.md)` — NOC / VOC template
- `[_docs/requirements/safety-codes-inspection-system-requirements.md](../requirements/safety-codes-inspection-system-requirements.md)` — authoritative system requirements

#### 1. Compliance Mapping Matrix

| Area                                          | Typical Public-Body Requirement            | CodeComply Feature (implemented or planned)                                                                                    |
| --------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| Safety Codes workflows                        | Qualified inspector identification         | SCO role, JWT authentication, designation-of-powers checks ([M-01])                                                            |
| Section 49 orders                             | Code reference + evidence for failed items | Deficiency capture with `codeReference`, photo evidence, GPS/timestamps ([M-05])                                               |
| Record integrity                              | Inspection records maintenance             | Append-only audit log (`audit_logs` table with DB trigger), immutable finalized inspections, SHA-256 document hashing ([A-06]) |
| FOIP safeguards (implementation-dependent)    | Collection limitation, need-to-know access | Configurable forms, purpose limitation, RBAC                                                                                   |
| Privacy protection (implementation-dependent) | Protection of personal information         | Encryption in transit (HTTPS), encrypted sensitive fields, role-based access controls                                          |
| Disclosure / audit response                   | Produce a complete record file             | Case export bundle (PDF + attachments + audit log); FOIP compliance search in Admin                                            |
| Notice of Compliance                          | Standard format compliance notices         | VoC workflow per deficiency; template-driven NOC documents (see requirements template)                                         |
| Verification of Compliance                    | Method of verification tracking            | VoC submission, accept/reject workflow; LSC-A-05 method-of-verification fields                                                 |

> ⚠️ **Important:** If you choose to cite specific statutory sections (e.g., s. 7, s. 15, s. 33, s. 38), have those citations validated by legal counsel before publication. Incorrect references damage credibility more than no references at all. For the open source community, maintain a `REGULATORY.md` file in the repository that tracks these mappings and their verification status.

#### 2. Privacy & Data Posture

- **Data classification and minimization** — documented in code and architecture decision records
- **Encryption standards (in transit and at rest)** — implementation auditable in the codebase; sensitive field encryption (M3-S2)
- **Data residency guidance** — deployment documentation must clearly advise agencies that Canadian hosting is essential for FOIP alignment, with Alberta-based hosting preferred. Be explicit: data residency is a deployment decision, not an inherent property of OSS. Include infrastructure-as-code templates or deployment guides for Canadian cloud regions. Current deployment target: [Render.com checklist](../internal/development/02-initial-setup/render-deployment-checklist.md) — extend with Canadian-region guidance
- **Access logging, monitoring, and breach response** — audit log service (`apps/api/src/services/audit-log.service.ts`); configurable per deployment
- **Retention schedules and disposal** — configurable by each agency to match their records management policies (10-year minimum recommended in compliance guide)

#### 3. Open Source Security Posture (Agencies Will Ask)

Add OSS-specific items that procurement teams now expect:

| Item                                            | Status in this project                                                     |
| ----------------------------------------------- | -------------------------------------------------------------------------- |
| SBOM availability                               | To be published                                                            |
| Release signing and verified builds             | To be implemented                                                          |
| Vulnerability disclosure policy (`SECURITY.md`) | **Not yet published — create**                                             |
| Dependency management policy                    | Document in `SECURITY.md`; pnpm lockfile + Dependabot/Renovate recommended |
| Patch SLAs                                      | Relevant for paid support contracts; otherwise document release cadence    |
| Security audit results                          | Community or professional, if conducted                                    |

#### 4. Operational Controls

**For the open source project itself:**

- Release management process (semantic versioning, changelogs, security advisories)
- Contribution guidelines that require regulatory impact consideration for changes affecting compliance-relevant features

**For agencies deploying the system** (documented in deployment guides):

- Backup and disaster recovery targets and recommended configurations
- Monitoring and uptime guidance — see [`_docs/internal/operations/runbook.md`](../internal/operations/runbook.md)
- Update and patch management procedures — see [CI/CD guide](../internal/development/01-governance/ci-cd-guide.md)

### C. In-App Compliance Indicators

Rather than marketing badges, build functional compliance features that demonstrate governance through actual system behavior. Because the code is open source, every one of these features is auditable — which is a stronger trust signal than any badge.

| Feature                         | Implementation in CodeComply                                                                                                                                        |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Audit Trail                     | Append-only `audit_logs` with DB trigger preventing UPDATE/DELETE; records inspection lifecycle, deficiencies, report distribution, RBAC denials                    |
| Versioned Templates             | Form/template version tracking for each inspection; template schemas version-controlled in the repository                                                           |
| Notice of Compliance Generation | VoC workflow and NOC PDF generation aligned to [`safety-codes-inspection-notice-of-compliance.md`](../requirements/safety-codes-inspection-notice-of-compliance.md) |
| Agency Branding Engine          | Agency logo and identity on reports (PDF templates in `apps/api/src/lib/pdf/templates/`) — agency remains the official authority                                    |
| FOIP Data Classification Labels | Tag records as appropriate (e.g., "Contains Personal Information — FOIP Protected"); configurable per agency                                                        |
| Role-Based Access Control       | SCO, Admin, and role-specific permissions; FOIP "need to know" enforcement                                                                                          |
| Evidence Handling               | Photo metadata preservation, Cloudflare R2 / MinIO storage, document hashing                                                                                        |
| Record Export                   | Complete inspection case file export (PDF + attachments + audit log) for disclosure requests                                                                        |
| FOIP Data Export Tools          | Admin compliance search (`ComplianceSearchView`) with CSV export and audit reference                                                                                |
| Safety Codes Act References     | `codeReference` on deficiencies; clause databases maintainable in the repository                                                                                    |
| Admin Attestation               | Configuration report export (RBAC settings, retention policies, encryption status) for PIAs and internal audits                                                     |

#### Visual Badge (If Used in the UI)

If you want a visual compliance indicator, label it carefully and link to full details:

```
┌──────────────────────────────────────────────────┐
│      ✓  ALBERTA REGULATORY ALIGNED               │
│                                                   │
│  • Safety Codes Act (RSA 2000, c. S-1)           │
│  • FOIP Act (RSA 2000, c. F-25)                  │
│  • Notice of Compliance Standards                 │
│                                                   │
│  Open source. Independently developed.            │
│  Not a Government of Alberta product.             │
│                                                   │
│  [View Compliance Details →]                      │
│  [View Source Code →]                             │
└──────────────────────────────────────────────────┘
```

The addition of **View Source Code** is intentional. For an open source project targeting agencies, the ability to verify claims by reading the code is a core trust differentiator.

### D. Documentation for Procurement, Auditors & Agency IT Teams

Agencies — especially municipalities and accredited bodies — must satisfy their own governance requirements before adopting any system. For an open source project, this means providing adoption-ready documentation that agencies can use directly or adapt for their internal processes. Publish these in a dedicated `_docs/procurement/` folder and as downloadable PDFs.

| Document                                        | Purpose                                                                                                     | Open Source Consideration                                                                                                                                                            |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Privacy Impact Assessment (PIA) Support Package | Data flows, roles, hosting details, safeguards — required under FOIP for public bodies adopting new systems | Pre-populated PIA template with CodeComply architecture and data handling. **Highest-impact adoption accelerator.**                                                                  |
| Security Architecture & Hardening Guide         | Architecture, encryption, access controls, penetration testing results                                      | Reference the open source codebase for verification; include recommended deployment configurations                                                                                   |
| SBOM & Dependency Policy                        | Supply-chain risk management                                                                                | List all dependencies, update/vetting policy, vulnerability monitoring approach                                                                                                      |
| Threat Model (High-Level)                       | Demonstrates secure-by-design thinking                                                                      | Publish in the repository; community can review and contribute                                                                                                                       |
| Compliance Mapping Document                     | Full regulatory feature matrix, expanded                                                                    | Maintain as `REGULATORY.md` in the repository                                                                                                                                        |
| Configuration & RBAC Reference                  | Needed for internal control reviews                                                                         | Document all configurable security and access settings                                                                                                                               |
| Logging & Audit Guide                           | Needed for incident response and oversight                                                                  | Document what is logged, how logs are protected, and how to review them                                                                                                              |
| Retention & Disposal Guide                      | How records are managed, retained, and securely destroyed                                                   | Document configurable retention features                                                                                                                                             |
| Incident Response Summary                       | Process, timelines, notification procedures                                                                 | Vulnerability disclosure for the project; template IR plan for agencies                                                                                                              |
| Deployment & Hosting Guide                      | Infrastructure requirements, Canadian hosting guidance                                                      | Extend [Render deployment checklist](../internal/development/02-initial-setup/render-deployment-checklist.md) with Canadian cloud regions (AWS `ca-central-1`, Azure Canada Central) |
| Backup & DR Guidance                            | Operational assurance                                                                                       | Recommended configurations and procedures                                                                                                                                            |
| Support & Maintenance Policy (LTS)              | What gets patched, for how long, and how fast                                                               | Relevant for paid support tiers; community edition documents release cadence                                                                                                         |
| Data Processing Addendum                        | Standard contract terms for data handling                                                                   | Relevant only for hosted/managed services                                                                                                                                            |

> **Key Insight:** The PIA Support Package and Deployment Guide are your most powerful adoption accelerators. Agencies that would take months to evaluate a proprietary vendor can move faster with open source if you remove the governance friction.

---

## 5. Part 4: Open Source Specific Branding & Community Elements

### Repository & Community Presence

| Element                 | Recommendation                                                                                                                                                                                                                                        |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repository Organization | `codecomply` (or chosen name, lowercase)                                                                                                                                                                                                              |
| License                 | Apache 2.0 recommended for broad agency adoption — permissive, well-understood by government legal teams, no copyleft obligations. MPL 2.0 is a reasonable alternative. **Avoid AGPL** — many government agencies restrict it. Consult legal counsel. |
| README Header           | "CodeComply — Open source inspection management for agencies operating under Alberta's Safety Codes Act"                                                                                                                                              |
| CONTRIBUTING.md         | Include a section on regulatory awareness — contributors modifying compliance-relevant features must document the regulatory context of their changes                                                                                                 |
| SECURITY.md             | Vulnerability disclosure policy with clear timelines. **Essential for agency trust — not yet published.**                                                                                                                                             |
| REGULATORY.md           | Living document mapping system features to specific regulatory requirements. **Recommended — not yet published.**                                                                                                                                     |
| CODE_OF_CONDUCT.md      | Standard open source code of conduct                                                                                                                                                                                                                  |
| CHANGELOG.md            | Detailed release notes with semantic versioning                                                                                                                                                                                                       |

### Support as the Primary Service (Sustainability Model)

Since the code is free and open source, professional support is the primary service offering and the project's sustainability model. Position support services clearly but separately from the open source project:

| Service Tier                  | Description                                                                           | Target                                                     |
| ----------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Community Support             | GitHub issues, discussions, community documentation                                   | All users — agencies, developers, contributors             |
| Agency Onboarding             | Deployment assistance, configuration, initial training                                | Agencies adopting CodeComply for the first time            |
| Managed Hosting               | Canadian-hosted, maintained, monitored deployment with FOIP-aligned infrastructure    | Agencies that prefer not to self-host                      |
| Compliance Consulting         | PIA support, regulatory mapping review, audit preparation                             | Agencies with specific governance requirements             |
| Priority Support (SLA-Backed) | Guaranteed response times, dedicated contact, incident support                        | Agencies requiring contractual support commitments         |
| Custom Development            | Feature development, integration with agency-specific systems (GIS, permitting, etc.) | Agencies with unique workflow requirements                 |
| LTS Maintenance               | Long-term support for designated release branches with security patches               | Agencies requiring stability and predictable update cycles |

**Branding note:** Label the support offering as **CodeComply Support** and position it as "Professional services for agencies deploying CodeComply." This makes the relationship clear: the code is the community's; the support is the service.

**Data sovereignty as a selling point:** "Because CodeComply is open source, your agency retains 100% data sovereignty. You can self-host on your own Canadian servers to guarantee FOIP alignment, or utilize our Managed Hosting service where we deploy the platform on FOIP-compliant, Alberta-based infrastructure."

---

## 6. Part 5: Final Recommended Branding Package

| Component              | Name               | Tagline                                                                                                                      |
| ---------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| Open Source Project    | CodeComply         | Open source inspection management — designed for Safety Codes compliance and FOIP-aligned record handling                    |
| Mobile App             | CodeComply Field   | Inspections in the field. Compliance in real time. Open source.                                                              |
| Admin Portal           | CodeComply Admin   | Manage inspections. Maintain compliance. Audit everything.                                                                   |
| API                    | CodeComply Connect | Integrations, sync, and reporting for agency systems                                                                         |
| Documentation          | CodeComply Docs    | Deployment, configuration, and regulatory guidance for agencies and contributors                                             |
| Support Services       | CodeComply Support | Professional services for agencies deploying CodeComply                                                                      |
| Managed Hosting        | CodeComply Managed | Expert hosting, PIA support, and SLA-backed maintenance for your agency                                                      |
| Compliance Positioning | —                  | Designed to support Alberta Safety Codes Act, FOIP, and Notice of Compliance requirements. Open source and agency-auditable. |

_(Use ™ only if you actually pursue trademark registration. Open source projects can and should trademark their names to prevent confusion — the trademark protects the name and brand, not the code. This is standard practice — e.g., Linux, Firefox, WordPress.)_

---

## 7. Part 6: Critical Next Steps

1. **Choose and apply an open source license.** This is foundational. Apache 2.0 is recommended for maximum agency adoption comfort. Have legal counsel review. Update the [README](../../README.md) license section.
2. **Trademark search.** Verify "CodeComply" (or your chosen name) availability through CIPO (Canadian Intellectual Property Office) and the Alberta corporate registry. Check domain availability. Secure the GitHub/GitLab organization name.
3. **Legal review.** Have compliance statements, any Act section citations, and all regulatory claims reviewed by counsel familiar with Alberta's Safety Codes Act and FOIP. For an open source project, also review disclaimer language ensuring the project and its contributors are appropriately protected from liability.
4. **Apply CodeComply branding in UI and documentation.** Replace interim "Safety Codes Inspection System" strings in app footers, PDF templates (`apps/api/src/lib/pdf/templates/`), OpenAPI titles, and user manuals. See [`_docs/internal/prompts/apply-branding.txt`](../internal/prompts/apply-branding.txt).
5. **Rename package scope.** Migrate `@acme/`_ to `@codecomply/_` across the monorepo when the brand is finalized.
6. **Build the PIA Support Package.** This is your single highest-impact adoption accelerator for agency customers. A pre-populated PIA template that agencies can complete for their specific deployment removes the biggest governance barrier to adoption.
7. **Publish deployment guides with Canadian hosting configurations.** Extend the [Render deployment checklist](../internal/development/02-initial-setup/render-deployment-checklist.md) with Canadian cloud region guidance (AWS `ca-central-1`, Azure Canada Central, or Canadian hosting providers).
8. **Establish the community infrastructure.** Repository, issue tracker, discussion forums, contribution guidelines, security disclosure process, and code of conduct. Publish `SECURITY.md` and `REGULATORY.md`.
9. **Publish governance and contribution model.** Document maintainers, roadmap process, issue triage policy, release cadence, and how regulatory-relevant contributions are reviewed.
10. **Define an LTS support model.** Define patch timelines, supported version branches, and optional paid SLAs. Agencies need predictability.
11. **Keep Alberta alignment claims careful and reviewable.** Avoid "FOIP compliant" language. Emphasize configurable controls and implementation responsibility. Maintain `REGULATORY.md` as a living, community-maintained document.
12. **Create a regulatory update process.** Reference specific Act versions in the codebase and documentation. Assign maintainers or create a working group responsible for tracking Alberta regulatory changes.
13. **Engage early adopter agencies.** Identify two or three agencies willing to pilot the system. Their feedback will shape the product, their deployment experiences will generate documentation, and their endorsement (even informal) will drive further adoption.
14. **Publish a public roadmap.** Agencies evaluating open source tools want to see project health and direction. See [`safety-codes-system-roadmap.md`](../internal/development/01-governance/safety-codes-system-roadmap.md).

---

This document is part of the CodeComply strategic documentation in `_docs/branding/`. It should be reviewed and updated as the project, community, and regulatory landscape evolve.
