# Regulatory Alignment

> **Status: DRAFT — living document.** This file maps CodeComply features to the
> regulatory context they are designed to support. It will be maintained as the project,
> community, and regulatory landscape evolve. Statutory section citations require review
> by qualified legal counsel before they are relied upon.

CodeComply is open source inspection management software **designed to support** workflows
under Alberta's Safety Codes Act and **aligned with** FOIP-oriented record handling and
Safety Codes Inspection Notice of Compliance requirements.

## Compliance Positioning (Read First)

- CodeComply is **designed to support** and is **aligned with** the regulatory framework
  below; it is **not "certified", "government approved", or "100% FOIP compliant"**, and no
  software can **guarantee** compliance.
- FOIP obligations apply primarily to public bodies. CodeComply provides features that
  **help** agencies meet those obligations; compliance is ultimately the deploying
  organization's responsibility and is **implementation-dependent**.
- This project is **independently developed by the community and is not endorsed by or
  affiliated with the Government of Alberta.**
- Because the code is open source, agencies can **audit these claims directly** in the
  codebase — verifiable transparency rather than marketing assertions.

## Statutory Framework

CodeComply is designed to operate within deployments subject to:

- **Safety Codes Act (RSA 2000, c. S-1)**
- **Administrative Items Regulation (AR 16/2004)**
- **Electronic Transactions Act (RSA 2000, c. E-5.5)**
- **Freedom of Information and Protection of Privacy Act (FOIP) (RSA 2000, c. F-25)**
- **Safety Codes Inspection Notice of Compliance** requirements

> ⚠️ If specific statutory sections (e.g., s. 7, s. 15, s. 33, s. 38, s. 49) are cited in
> documentation or the product, have those citations validated by legal counsel before
> publication. Incorrect references damage credibility more than no references at all.

## Compliance Mapping Matrix

Feature status is **implemented or planned** and **implementation-dependent** per
deployment. "Verification status" tracks how the alignment is evidenced in this repository.

| Area                                          | Typical public-body requirement            | CodeComply feature (designed to support)                                                         | Verification status |
| --------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------ | ------------------- |
| Safety Codes workflows                        | Qualified inspector identification         | SCO role, JWT authentication, designation-of-powers checks                                       | Implemented         |
| Section 49 orders                             | Code reference + evidence for failed items | Deficiency capture with `codeReference`, photo evidence, GPS/timestamps                          | Implemented         |
| Record integrity                              | Inspection records maintenance             | Append-only `audit_logs` (DB trigger), immutable finalized inspections, SHA-256 document hashing | Implemented         |
| FOIP safeguards (implementation-dependent)    | Collection limitation, need-to-know access | Configurable forms, purpose limitation, role-based access control (RBAC)                         | Implemented         |
| Privacy protection (implementation-dependent) | Protection of personal information         | Encryption in transit (HTTPS), encrypted sensitive fields, role-based access controls            | Implemented         |
| Disclosure / audit response                   | Produce a complete record file             | Case export bundle (PDF + attachments + audit log); compliance search in CodeComply Admin        | Implemented         |
| Notice of Compliance                          | Standard-format compliance notices         | VoC workflow per deficiency; template-driven NOC documents                                       | Implemented         |
| Verification of Compliance                    | Method-of-verification tracking            | VoC submission, accept/reject workflow; method-of-verification fields                            | Implemented         |
| Data residency                                | Canadian hosting for FOIP alignment        | Deployment-time decision; Canadian-region hosting guidance in deployment docs                    | Documented (deploy) |
| Supply-chain / disclosure                     | Vulnerability handling                     | See [`SECURITY.md`](SECURITY.md)                                                                 | Draft               |

## Data & Privacy Posture (Implementation-Dependent)

- **Data minimization & classification** — configurable forms and FOIP data-classification labels.
- **Encryption** — in transit (HTTPS) and sensitive-field encryption; auditable in the codebase.
- **Data residency** — agencies should host in Canadian regions (Alberta-based preferred) for FOIP alignment. Residency is a deployment decision, not an inherent property of the software.
- **Access logging & audit** — append-only audit log service; configurable per deployment.
- **Retention & disposal** — configurable retention schedules per the agency's records management policy.

## Reference Documents

- [`_docs/requirements/alberta-safety-codes-compliance-guide.md`](_docs/requirements/alberta-safety-codes-compliance-guide.md) — statutory framework and technical compliance mapping.
- [`_docs/requirements/safety-codes-inspection-notice-of-compliance.md`](_docs/requirements/safety-codes-inspection-notice-of-compliance.md) — NOC / VoC template.
- [`_docs/requirements/safety-codes-inspection-system-requirements.md`](_docs/requirements/safety-codes-inspection-system-requirements.md) — authoritative system requirements.
- [`_docs/branding/branding-guide.md`](_docs/branding/branding-guide.md) — branding and regulatory-alignment strategy (Part 3).
- [`SECURITY.md`](SECURITY.md) — vulnerability disclosure policy (draft).

## Maintenance

This is a living document. Changes to compliance-relevant features should update the matrix
above and note the regulatory context. A formal regulatory-update process and the
assignment of maintainers responsible for tracking Alberta regulatory changes are planned
follow-ups.
