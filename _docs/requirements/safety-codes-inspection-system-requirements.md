# CodeComply Requirements Specification

## 1. System Overview

CodeComply consists of two integrated applications:

### 1.1 CodeComply Field

A lightweight, offline-first application used by certified Safety Codes
Officers (SCOs) to capture inspection data and evidence in the field.

Authoritative for: - Inspection event data (once finalized)

### 1.2 CodeComply Admin

A web-based management system serving as the system of record for
permits, assignments, templates, user permissions, and compliance
records.

Authoritative for: - Permits - Assignments - Checklist templates - Code
libraries - User certifications

---

# Part A: CodeComply Field (Mobile Inspection PWA)

## 1. Technology Stack

- **Framework**: Vue 3 with Composition API
- **Build Tool**: Vite
- **UI Library**: Tailwind CSS with a component library like PrimeVue or similar
- **State Management**: Pinia
- **Routing**: Vue Router
- **PWA Framework**: Vite PWA Plugin
- **Offline Storage**: IndexedDB (via `Dexie.js` or similar wrapper)

## 2. Functional Requirements

### M-01 Authentication & Authority

- Integration with Organization SSO (OAuth 2.0/OIDC).
- Role enforcement based on downloaded certification profile.
- Long offline sessions supported via service worker caching and token refresh.
- Grace period (8–12 hours) for expired tokens if previously authenticated.
- Forced re-authentication if:
  - Certification revoked (indicated by API).
  - Device unused for a configurable number of days.

### M-02 Site & Permit Retrieval

- GPS-based "Find Permits Near Me" using the Web Geolocation API.
- Local search by Permit Number or Address (searching against the local DB).
- Clear display of:
  - Permit Scope
  - Legal Land Description
- Optional geofence warning if the inspector is outside a configurable radius.

### M-03 Offline Workflow (PWA)

#### Sync Down (Service Worker & Background Sync)

- Download assigned inspections, permit data, and checklist templates on the first load and in the background.
- Use of a service worker to cache all application assets (`app shell`).

#### Local Storage (IndexedDB)

- Use IndexedDB for storing structured data (inspections, permits, etc.).
- Photos and other binary data stored in IndexedDB or the Cache API.
- Encryption of sensitive data in the local database.

#### Sync Up (Background Sync API)

- Auto-upload on connectivity restore using the Background Sync API.
- Manual "Force Sync" button.
- Sync status indicator (Pending / Uploaded / Failed).
- Exponential backoff retry logic for failed syncs.

#### Conflict Resolution

- Field data authoritative for inspection results only.
- Server authoritative for permit metadata.
- Conflicts logged for audit.

### M-04 Inspection Execution

- Thumb-friendly large buttons: Pass / Fail / N/A.
- Maximum 3 taps per checklist result.
- Confirm dialog for "Pass All".
- Filter: "Show Failed Only".
- Auto-scroll to the next failed item.
- Code reference selection required when marking Fail.

### M-05 Evidence & Orders

- Mandatory photo capture for failed items using the Web Capture API.
- Built-in photo annotation tools (using a canvas-based library).
- Voice-to-text for deficiency notes (using the Web Speech API).
- Photos auto-embed:
  - Timestamp
  - GPS coordinates
  - Inspector ID
  - Permit number
- Optional visible watermark.
- Distinct "Stop Work" / "Unsafe Condition" workflow.

### M-06 Finalization

- Pre-submit validation ensures:
  - All required items answered.
  - Required photos present.
  - Outcome selected.
  - Digital signature captured (recommended, using a canvas-based signature pad).
- Outcomes: Acceptable, Acceptable with Conditions, Refused.
- After successful sync, the inspection becomes read-only.

### M-07 Device Security Controls

- Configurable screenshot blocking (via platform-specific settings if possible).
- Auto-logout after a configurable idle period.
- Remote wipe capability for lost devices (achieved by clearing the service worker cache and IndexedDB).

## 3. Non-Functional Requirements

### NFR-M-01 (UI/UX)

- High contrast outdoor mode (theme switcher).
- Responsive, mobile-first design that works on tablets and phones.
- App-like feel with smooth transitions and animations.

### NFR-M-02 (Performance & Battery)

- Minimal background services.
- Full-shift battery target (8–10 hours).
- Lazy loading of routes and components.
- Optimized image handling (compression before upload).

### NFR-M-03 (Security)

- Encryption of data in IndexedDB.
- TLS 1.2+ in transit.
- Content Security Policy (CSP) to prevent XSS attacks.

### NFR-M-04 (PWA Specific)

- **Installability**: The app must be installable on the home screen.
  - Platform-specific installation instructions displayed to users on first visit
  - Instructions include step-by-step guidance for iOS (Safari) and Android (Chrome)
  - Installation instructions automatically hidden once app is installed (detected via display mode)
  - Collapsible instruction panel to avoid UI clutter
- **Offline Support**: All core functions must be available offline.
- **Discoverability**: The app should be easily discoverable via a web browser.
- **Re-engageable**: The app should be able to send push notifications for important updates (e.g., new assignments).

---

# Part B: CodeComply Admin

## Functional Requirements

### A-01 User & Certification Management

- Manage SCO registry.
- Map disciplines and authorities.
- Configure SSO connection.
- Snapshot certification at time of inspection for legal record.

### A-02 Permit & Assignment Management

- Sync active permits from municipal system.
- Assignment grid view.
- Calendar-based workload view.
- Bulk reassignment capability.

### A-03 Checklist & Code Configuration

- Template builder for inspections.
- Code library management.
- Versioning:
  - Immutable once used in submitted inspection.
  - New edits create new version.
  - Inspections reference version hash.

### A-04 Reporting & Distribution Engine

- Automatic PDF generation on sync.
- Embed:
  - Inspector name and designation ID
  - GPS coordinates
  - Timestamp
  - Photos
- Unique report ID.
- SHA-256 document hash stored.
- Optional QR verification code.
- Automated email distribution.

### A-05 Order Processing & Escalation

- **Real-time Alerting**: Immediate "Red-Flag" dashboard notification upon sync of a "Stop Work" or "Unsafe Condition" outcome.
- **Automated Service**:
  - Immediate email delivery of the Section 49 Order to the Applicant and Owner.
  - Integration with an email tracking service to provide "Proof of Service" (Delivery & Open receipts).
- **Stakeholder Escalation**:
  - High-priority SMS alert to the Senior SCO.
  - Automated weekly summary report of all outstanding/unresolved Orders for Management.
- **Legal Compliance Logic**:
  - Automatic calculation of the 14-day Appeal Deadline based on the "Date of Service."
  - "Lock-out" logic preventing any other SCO from overriding the Stop Work status without Senior SCO approval.

### A-06 Records & Compliance

- Append-only inspection records.
- No deletion permitted.
- Addendum mechanism:
  - References original record ID
  - Includes reason
  - Time-stamped and signed
- Advanced FOIP search:
  - Legal Land Description
  - Date
  - Inspector
  - Permit Number

## Non-Functional Requirements

### NFR-A-01 (Security)

- RBAC separation:
  - Inspectors (view own)
  - Admins (view all)

### NFR-A-02 (Integration)

- High-volume concurrent photo upload support.
- Separate optimized binary upload endpoint.

### NFR-A-03 (Availability)

- 99.5% uptime during business hours.
- Daily backups with geo-redundancy.

### NFR-A-04 (Retention)

- Data retained per legislative minimum (configurable years).

### NFR-A-05 (Performance)

- PDF generation under 10 seconds (20 photos).
- Support simultaneous end-of-day sync (50+ inspectors).

## Legacy System Compatibility

These requirements are incorporated from the legacy permitting application to enhance the system.

### LSC-A-01 Inspection Date Management

- Support for multiple inspection date types: Requested Date, Planned Inspection Date, Actual Inspection Date.

### LSC-A-02 Inspection Stages

- Multi-select for inspection stages (e.g., Foundation, Framing, Rough-in, Insulation, Final, Other).
- "Other" stage requires additional description.
- Checkbox for "No Further Inspections Required".

### LSC-A-03 Unable to Enter Workflow

Section for handling unable to enter situations.

- Fields for Date of 1st Notification (required), Date of 2nd Notification (optional), Comments.
- Integration with document generation for No Entry Letters.
  - Back-Office should automatically flag the permit for a "Re-inspection Fee" as soon as this form is synced.- - Automated Email: Per Alberta's Permit Regulation, a notice of no-entry must be issued to the Owner, even if the contractor was the one who missed the appointment.
  - Geofence Proof: Use the GPS data from your M-02 requirement to prove the inspector was actually at the site at the time of the attempt.

## LSC-A-04 Deficiency Management

- Capabilities to Add/Edit/Delete deficiencies.
- Fields per deficiency: Code Reference, Description, Due Date, Status (Open/Resolved).
- Ability to link deficiencies to Verification of Compliance (VOC) for resolution.

## LSC-A-05 Verification of Compliance (VOC)

- Capabilities to Add/Edit/Delete Verification of Compliance.
- Fields: Verification Date, Section Title (unique), Title, Name, Method (Written Assurance, Site Visit, Verbal Assurance, Other), Comments.
- Linking to deficiencies for resolution tracking.
- Automatically linking the Related_Order_Number in Verification of Compliance document back to the original Order in the database. This creates a "linked audit trail" which is highly valued during a Safety Codes Council Audit.

## LSC-A-06 Document Management

- Sections for Uploaded Documents and Generated Documents.
- Upload controls for supporting documents.
- Generation of documents like No Entry Letters, Inspection Reports.
- Support for PDF and Word formats, electronic signing, and emailing

---

# Part C: General Requirements

## Legal Integrity Requirements

Each inspection record must include:

- Unique immutable ID
- Created timestamp
- Finalized timestamp
- Inspector ID
- Certification snapshot
- GPS at start and finalize

Addendums must: - Reference original inspection ID - Include reason for
amendment - Be time-stamped and signed

## Architecture Guidance (Non-Binding)

- Object storage (Cloudflare R2) for photos — S3-compatible API with zero egress fees (see architecture docs for MinIO in local development).
- Relational database for metadata.
- Append-only audit log.
- Separate upload service for binary files.
