# CareBridge 9.5 Enterprise Standard

CareBridge is not considered a 9.5/10 enterprise platform because a feature exists or a screen looks premium. A category reaches 9.5 only when its production acceptance gates are implemented, secured, tested, observable and recoverable.

## Target scorecard

| Area | 9.5 acceptance gate |
| --- | --- |
| Patient UX | Premium responsive experience, role/patient-specific visibility, WCAG AA, consistent live state, no legacy layout leakage, performance budget met |
| Doctor UX | Encounter-first chart, CPOE, result review, prescriptions, messaging/video, structured documentation, safe clinical workflow |
| Nurse / Pharmacy | Dispensing workflow, inventory controls, clinical-order execution, stock thresholds, auditability, medication safety |
| Admin / Operations | Hospital command centre, patient experience policy, capacity, finance, reports, cases, readiness/integrity diagnostics |
| Clinical EHR | Longitudinal chart, conditions, observations, labs, notes, prescriptions, orders, results, coding, signatures/co-signatures, order sets and clinical decision support |
| Interoperability | FHIR R4, SMART on FHIR/OAuth, HL7 v2 integration, terminology services, DICOM/PACS bridge and documented integration contracts |
| Billing / Revenue cycle | Verified payments, receipts, NHIS workflows, eligibility/claims lifecycle, reconciliation, denial handling and auditable adjustments |
| Security / Compliance | Least privilege, MFA-ready auth, session hardening, immutable/auditable events, encryption, rate limiting, CSP/security headers, secret management, retention controls and security testing |
| Reliability / Scalability | Production database, migrations, transactions, cache/queue, idempotency, health/readiness, backups/PITR, HA deployment, load tests and disaster recovery |
| Observability | Structured logs, request IDs, metrics, traces, alerting, SLOs and operations diagnostics |
| Realtime / Messaging | Authenticated sockets, consistent unread state, reconnect/idempotency, delivery semantics and operational monitoring |
| Telehealth | Authenticated rooms, TURN/STUN production configuration, connection diagnostics, consent and secure media policies |
| Mobile / Accessibility | Responsive/PWA quality, keyboard/screen-reader support, reduced motion, touch ergonomics and tested device matrix |

## Phase 1 — implemented and regression-tested on Premium V6

- Authenticated FHIR R4 gateway with CapabilityStatement and Patient, Practitioner, Appointment, Observation, Condition, MedicationRequest and Encounter resources.
- LOINC/UCUM-aware observation mappings for vitals and laboratory data.
- CPOE clinical-order foundation for lab, imaging, medication and procedure orders.
- Controlled order lifecycle: draft → active → in progress → completed/cancelled.
- Structured coding fields, priorities, clinical reasons, specimen/body-site metadata and result capture.
- Patient notification/email integration for active/completed clinical orders.
- A staff Clinical Orders workstation for doctors, nurses and operations; completed lab results file back into the longitudinal record.
- CI regression for FHIR R4 and CPOE order lifecycle.
- Route-level React code splitting, reducing the main production JavaScript chunk from roughly 671 kB to roughly 360 kB before gzip.
- Admin enterprise readiness/integrity API covering duplicate identities, dangling clinical references, ward capacity invariants, held-bed accounting, audit presence and production configuration checks.
- Dual-scope patient experience policy: hospital-wide default plus per-patient inheritance/overrides.

## Phase 2 — implemented and regression-tested on Premium V6

- Atomic local/demo persistence using temp-write + fsync + atomic rename rather than direct file replacement.
- SHA-256 state checksums, retained recovery backups and an append-only write journal for the local/demo store.
- Public liveness/readiness split with persistence and security state in `/api/health` and `/api/ready`.
- Per-request UUID correlation IDs and structured JSON HTTP telemetry.
- Security headers including CSP, frame denial, HSTS in production, no-sniff, permissions policy and no-store API responses.
- Request-class throttling with tighter limits for login, registration and public contact surfaces.
- Stronger password policy for new/reset credentials while preserving migration of existing scrypt accounts.
- Bounded concurrent sessions, active-session inventory and revoke-other-session controls.
- Password changes and administrative resets revoke other sessions and are audited.
- PostgreSQL 17 schema/migration foundation with versioned JSONB state, transactional updates and checksums.
- Optimistic-concurrency protection that rejects stale state writes.
- Transactional PostgreSQL outbox using `FOR UPDATE SKIP LOCKED` for durable background-delivery work.
- Tamper-evident PostgreSQL audit chain using previous-event and event SHA-256 hashes.
- Admin readiness, capability and process/HTTP metrics endpoints.
- CI now boots a real PostgreSQL 17 service and proves migrations, transactional persistence, checksum round-trips, stale-write rejection, outbox claiming/delivery and audit-chain continuity.
- Separate CI security regression proves CSP/request IDs, weak-password rejection, session revocation, brute-force throttling, atomic persistence recovery artifacts and Admin operations telemetry.

## Phase 3 — in progress

- TOTP multi-factor authentication engine with encrypted-at-rest authenticator secrets, short-lived login challenges and one-time recovery-code support.
- Promotion of PostgreSQL from a tested transactional adapter to the primary production runtime store.
- SMART on FHIR/OAuth client and scope model.

## Remaining gates before a defensible 9.5 overall score

1. Promote PostgreSQL to the primary production system of record and complete cutover/rollback tooling; keep the atomic JSON store for local/demo fixtures only.
2. Add Redis-backed cache/session coordination and a durable worker runtime for email, webhooks, reports and long-running operations (the PostgreSQL outbox foundation is already in place).
3. Complete TOTP MFA end-to-end and add recovery/administrative security workflows.
4. Add SMART on FHIR/OAuth scopes and an integration-client registry.
5. Add HL7 v2 ADT/ORM/ORU interfaces and DICOM/PACS integration contracts.
6. Add terminology-backed coding for diagnoses, labs and medications (SNOMED CT / ICD / LOINC / RxNorm or locally licensed equivalents).
7. Add clinical signatures/co-signatures, order sets, result acknowledgement, medication/allergy/interaction safety and decision-support rules.
8. Add revenue-cycle claims, eligibility, reconciliation and denial workflows beyond direct patient payments.
9. Add distributed traces, externally scrapeable metrics, SLO dashboards and production alert routing.
10. Add backup/PITR, restore drills, horizontal deployment, load/soak tests and disaster-recovery acceptance tests.
11. Finish accessibility and performance budgets across every role and device class.

## Release rule

Do not call CareBridge 9.5 overall until every category above has evidence from automated tests, production configuration checks or a documented operational acceptance test. Visual polish alone cannot raise infrastructure, interoperability, security or clinical-safety scores.
