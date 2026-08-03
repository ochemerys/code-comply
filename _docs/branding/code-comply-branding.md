# CodeComply: A Public Declaration of Purpose

**Open-source inspection management for Alberta Safety Codes agencies**

CodeComply exists to make public-interest inspection work easier to operate, easier to audit, and easier to improve.

We are building a practical digital workbench for municipalities, accredited agencies, Safety Codes Officers (SCOs), administrators, and the technical teams that support them. The project starts with inspection workflows under Alberta's Safety Codes framework: field work, evidence capture, deficiencies, Verification of Compliance (VoC), reporting, and the administrative work around them.

CodeComply is also a real-world proving ground for responsible AI-assisted software maintenance. Its public issue history, architectural rules, tests, and human decisions help us learn how AI can support maintainers without quietly replacing professional or community judgment.

These two goals reinforce each other:

1. deliver useful, trustworthy inspection infrastructure in the open; and
2. develop a transparent, human-governed way to maintain complex public-interest software.

---

## Why CodeComply exists

Inspection teams are often asked to do critical work with fragmented tools: paper forms, spreadsheets, generic form builders, disconnected photo storage, and rigid proprietary systems. The result can be repeated data entry, delayed reports, incomplete records, difficult audits, and dependence on a single vendor.

We believe agencies should have another option:

- software they can evaluate before committing to it;
- source code their technical and security teams can inspect;
- data they can host, export, and retain under their own policies;
- field tools that continue to work when connectivity does not;
- workflows shaped with SCOs rather than imposed on them; and
- an open foundation that can be adapted as regulations and agency practices evolve.

The goal is not digitization for its own sake. The goal is to reduce avoidable clerical work and operational friction so qualified people can spend more time on safety, evidence, communication, and professional judgment.

---

## What we are building

CodeComply is intended to support the inspection lifecycle from assignment through closure:

```text
Permits and assignments
          ↓
Field inspection and evidence capture
          ↓
Deficiencies, notices, and follow-up
          ↓
Verification of Compliance
          ↓
Reports, records, and audit history
```

The project is organized around three public components:

- **CodeComply Field** — an offline-capable web application for SCOs performing inspections, recording checklist results, capturing evidence, documenting deficiencies, and synchronizing work.
- **CodeComply Admin** — an administrative workspace for assignments, users, certifications, templates, code references, VoC review, reports, records, and operational oversight.
- **CodeComply Connect** — an API for agency systems, integrations, import and export, reporting, and future interoperability.

Our public technical foundation includes the inspection domain model, configurable and versioned templates, field execution, reporting, organizational controls, APIs, deployment tooling, and documentation needed for a genuinely usable self-hosted system.

We will describe implemented features and future plans separately. A roadmap item is not a product claim.

---

## What CodeComply is not

CodeComply does not replace Safety Codes Officers, accredited agency quality management systems, or the legal responsibilities of a deploying organization.

It is not:

- an autonomous authority that interprets safety codes;
- an automated system that approves plans, issues permits, or makes enforcement decisions;
- a substitute for SCO certification or professional judgment;
- certified, approved, or endorsed by the Government of Alberta; or
- a promise that installing software alone makes an organization compliant.

Checklists and code references help officers record and communicate decisions. Qualified people remain responsible for interpretation, severity, enforcement, sign-off, and verification.

Future AI-assisted capabilities may help prepare templates, identify incomplete evidence, draft report narratives, or highlight records for review. They must remain reviewable, disclose their role, and keep a human accountable for consequential decisions.

---

## Our commitments

### 1. Open source must be useful, not ceremonial

The public project should be capable of supporting real inspections. We do not intend to publish a hollow demo while reserving every operationally meaningful feature for a private product.

Agencies must be able to inspect the code, run it themselves, modify it, build integrations, and move their data without paying to escape the platform. The repository should remain a credible foundation for community deployment and development.

### 2. Officers are augmented, not replaced

CodeComply should automate repetition, not accountability. It can organize assignments, cache records for offline work, capture photos and notes, generate consistent documents, and preserve an audit trail. It must not disguise a software recommendation as a professional decision.

### 3. Agencies retain control of their data

Inspection records can contain personal information, property access details, and photographs of private spaces. Deploying organizations should control where that data is hosted, who can access it, how long it is retained, and how it is exported or destroyed.

Self-hosting and Canadian-region deployment should be practical choices. Data residency is a property of a deployment—not an automatic benefit conferred by an open-source label.

### 4. Regulatory claims must be precise

CodeComply is designed to support workflows under Alberta's Safety Codes Act and to help agencies implement privacy, records, and audit controls relevant to their obligations.

We will say **supports** or **is designed to align with**, not **certified**, **government approved**, or **guaranteed compliant**. Configuration, hosting, policy, training, and operational practice all affect the compliance posture of a deployment.

Where the project maps software behavior to regulatory requirements, that mapping should be documented, reviewable, versioned, and corrected when better information becomes available.

### 5. Security and auditability are product requirements

Trust must be demonstrated through system behavior and public evidence. Our direction includes:

- least-privilege access and clear role boundaries;
- traceable inspection and administrative actions;
- protected evidence and record integrity;
- documented data flows, retention, backup, and recovery;
- secure deployment guidance and vulnerability reporting;
- dependency transparency and reproducible release practices; and
- exportable records that agencies can use for oversight and disclosure.

Open code does not make software secure by itself. It makes claims inspectable and creates an opportunity for broader review; maintainers still have to respond responsibly.

### 6. Interoperability prevents the next lock-in

Permitting, identity, GIS, document storage, and reporting environments differ across agencies. CodeComply should expose stable APIs and clean provider interfaces so organizations can connect existing systems and choose suitable identity, storage, notification, reporting, and future AI services.

No single hosted service should become the only practical way to use the public project.

### 7. Accessibility and field reality matter

Inspection software is used on job sites, in vehicles, at service counters, and under unreliable network conditions. We prioritize mobile usability, offline behavior, recoverable synchronization, clear language, accessible interfaces, and evidence capture that does not obstruct the inspection itself.

---

## A second mission: responsible AI-assisted maintenance

CodeComply is intentionally maintained as more than an application. It is a reference project for learning how AI can help sustain a complex codebase over time.

The maintenance system is expected to assist with work such as:

- classifying and summarizing incoming issues;
- checking proposed changes against documented architecture and policy;
- identifying affected tests and documentation;
- drafting implementation or review suggestions;
- tracking decisions and regressions; and
- keeping maintainers aware of inconsistencies as the repository grows.

This mission depends on authentic, structured feedback. Real bug reports, workflow requests, regulatory updates, and integration needs are more valuable than vanity metrics because they test whether AI assistance can understand context and help produce maintainable outcomes.

Our governance principle is simple:

> AI may accelerate analysis and implementation, but accountable humans set policy, validate domain meaning, review consequential changes, and make release decisions.

Where practical, issue discussions should preserve the distinction between AI-generated analysis and human confirmation. Failures, corrections, and disagreements are useful project evidence and should not be hidden to make the automation appear more capable than it is.

This maintenance research is not a claim that CodeComply uses AI to interpret Alberta safety codes in the field. Product automation and repository maintenance are separate concerns, and we will keep that boundary explicit.

---

## Community participation

CodeComply needs both technical and domain expertise.

SCOs and agency staff can contribute without becoming software developers or spending their day in a public issue tracker. Useful input includes:

- common deficiencies and difficult field scenarios;
- time-consuming administrative or VoC follow-up work;
- offline, synchronization, photo, and document-handling problems;
- terminology, forms, and workflow differences among disciplines;
- privacy, records, accessibility, and procurement requirements; and
- integrations that would make adoption practical.

Developers, designers, privacy and security professionals, municipal IT teams, educators, consultants, and vendors can contribute code, tests, documentation, deployment patterns, integrations, threat analysis, and implementation experience.

When operational details cannot be shared publicly, the project should provide a safe reporting path and work with the reporter to create a sanitized issue where possible. Public participation must never require an agency to disclose protected information.

Maintainers should turn community input into structured, testable work and explain what was accepted, deferred, or declined. Contributors deserve visible decisions, not a submission form that leads nowhere.

---

## A sustainable open-source project

Long-term maintenance requires funding. Our intended model separates the open foundation from optional services built around it.

The public CodeComply core is the adoption and collaboration layer. Sustainable revenue may come from:

- managed Canadian hosting;
- onboarding, migration, configuration, and training;
- priority support and long-term maintenance agreements;
- agency-specific integrations and implementation work;
- compliance and deployment consulting; and
- optional advanced services, including carefully governed AI-assisted capabilities.

Organizations pay for reduced operational burden, dependable service, support commitments, and specialized outcomes—not for artificial restrictions on access to their own inspection data.

Commercial offerings should strengthen the public project by funding maintenance, improving documentation, and returning broadly useful fixes to the shared foundation. Their existence and boundaries should be clear. Self-hosting must remain a respected deployment choice, while managed services provide a practical option for organizations that do not want to operate the platform themselves.

---

## Direction of travel

Our immediate focus is a reliable Alberta-oriented inspection workflow:

1. make field execution, synchronization, evidence capture, deficiencies, VoC, and reporting dependable;
2. provide clear deployment, security, privacy, backup, and upgrade guidance;
3. make agency configuration and data export understandable;
4. publish regulatory mappings with appropriate caveats and review;
5. improve structured feedback and safe reporting paths;
6. validate AI-assisted maintenance against real issues and human-reviewed outcomes; and
7. learn from pilot deployments before making broader claims.

Over time, the architecture may support additional inspection contexts and jurisdictions. Expansion should come from demonstrated needs and reusable foundations, not from pretending every inspection domain is the same. Alberta Safety Codes workflows are the starting commitment.

---

## How we will measure progress

Repository stars and promotional reach can help discovery, but they are not the principal measure of success.

We care more about whether:

- an officer can complete and synchronize a real inspection reliably;
- an administrator can follow a deficiency through VoC and produce the required record;
- an agency can understand, deploy, secure, back up, and export the system;
- users can report problems safely and receive a clear response;
- contributions improve tests, documentation, and regulatory traceability;
- AI-assisted maintenance recommendations survive informed human review; and
- pilots produce evidence of time saved, fewer incomplete records, and lower operational burden.

The project succeeds when it creates trustworthy public infrastructure, a healthy contribution loop, and a sustainable way to maintain both.

---

## Independence and responsibility

CodeComply is an independently developed open-source project. It is not endorsed by or affiliated with the Government of Alberta, the Alberta Safety Codes Authority, or any accredited agency unless an explicit written relationship is announced.

The software is provided under the repository's open-source license. Each deploying organization remains responsible for its configuration, hosting, privacy impact assessment, security controls, records policies, training, quality management system, and compliance with applicable law.

CodeComply supports inspection work. It does not transfer that responsibility away from the people and organizations entrusted with public safety.
