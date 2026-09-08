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

## Phase 1 — implemented on Premium V6

- Authenticated FHIR R4 gateway with CapabilityStatement and Patient, Practitioner, Appointment, Observation, Condition, MedicationRequest and Encounter resources.
- LOINC/UCUM-aware observation mappings for vitals and laboratory data.
- CPOE clinical-order foundation for lab, imaging, medication and procedure orders.
- Controlled order lifecycle: draft → active → in progress → completed/cancelled.
- Structured coding fields, priorities, clinical reasons, specimen/body-site metadata and result capture.
- Patient notification/email integration for active/completed clinical orders.
- CI regression for FHIR R4 and CPOE order lifecycle.
- Route-level React code splitting to reduce initial JavaScript startup cost.
- Admin enterprise readiness/integrity API covering duplicate identities, dangling clinical references, ward capacity invariants, held-bed accounting, audit presence and production configuration checks.
- Dual-scope patient experience policy: hospital-wide default plus per-patient inheritance/overrides.

## Remaining gates before a defensible 9.5 overall score

1. Replace development JSON persistence with a transactional production database and migrations. PostgreSQL is the preferred target; keep the JSON store only for local/demo fixtures.
2. Add Redis-backed cache/session coordination and a durable job queue for email, webhooks, reports and long-running operations.
3. Add SMART on FHIR/OAuth scopes and an integration-client registry.
4. Add HL7 v2 ADT/ORM/ORU interfaces and DICOM/PACS integration contracts.
5. Add terminology-backed coding for diagnoses, labs and medications (SNOMED CT / ICD / LOINC / RxNorm or locally licensed equivalents).
6. Add clinical signatures/co-signatures, order sets, result acknowledgement, medication/allergy/interaction safety and decision-support rules.
7. Add revenue-cycle claims, eligibility, reconciliation and denial workflows beyond direct patient payments.
8. Add MFA-ready authentication, rate limiting, CSP, immutable audit chaining, formal retention controls and automated security tests.
9. Add structured logs, request IDs, metrics/tracing, SLO dashboards and alerts.
10. Add backup/PITR, restore drills, horizontal deployment, load/soak tests and disaster-recovery acceptance tests.
11. Finish accessibility and performance budgets across every role and device class.

## Release rule

Do not call CareBridge 9.5 overall until every category above has evidence from automated tests, production configuration checks or a documented operational acceptance test. Visual polish alone cannot raise infrastructure, interoperability, security or clinical-safety scores.
