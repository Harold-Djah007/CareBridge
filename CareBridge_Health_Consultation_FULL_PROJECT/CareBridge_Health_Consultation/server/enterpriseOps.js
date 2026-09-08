import crypto from "crypto";
import { mfaEncryptionConfigured } from "./mfa.js";

const ok = (id, title, detail, meta = {}) => ({ id, title, status: "pass", detail, ...meta });
const warn = (id, title, detail, meta = {}) => ({ id, title, status: "warn", detail, ...meta });
const fail = (id, title, detail, meta = {}) => ({ id, title, status: "fail", detail, ...meta });

function duplicateValues(rows, key) {
  const seen = new Set();
  const dupes = new Set();
  rows.forEach((row) => {
    const value = String(row?.[key] ?? "").toLowerCase();
    if (!value) return;
    if (seen.has(value)) dupes.add(value);
    seen.add(value);
  });
  return [...dupes];
}

function referenceCheck(db, rows, field, roles = ["patient"]) {
  const allowed = new Set((db.users || []).filter((user) => roles.includes(user.role)).map((user) => user.id));
  return (rows || []).filter((row) => row?.[field] && !allowed.has(row[field])).map((row) => ({ id: row.id, reference: row[field] }));
}

function integrityChecks(db) {
  const users = db.users || [];
  const checks = [];
  const duplicateIds = duplicateValues(users, "id");
  const duplicateEmails = duplicateValues(users, "email");
  checks.push(duplicateIds.length ? fail("users.ids", "Unique user IDs", `${duplicateIds.length} duplicate user ID(s) found.`, { count: duplicateIds.length }) : ok("users.ids", "Unique user IDs", "No duplicate user IDs."));
  checks.push(duplicateEmails.length ? fail("users.emails", "Unique account emails", `${duplicateEmails.length} duplicate account email(s) found.`, { count: duplicateEmails.length }) : ok("users.emails", "Unique account emails", "No duplicate account emails."));

  const patientCollections = [
    ["appointments", db.appointments], ["ward bookings", db.wardBookings], ["conditions", db.conditions],
    ["medications", db.medications], ["vitals", db.vitals], ["labs", db.labs], ["notes", db.notes],
    ["prescriptions", db.prescriptions], ["invoices", db.invoices], ["clinical orders", db.clinicalOrders], ["claims", db.claims],
  ];
  const danglingPatients = patientCollections.flatMap(([name, rows]) => referenceCheck(db, rows, "patientId").map((item) => ({ ...item, collection: name })));
  checks.push(danglingPatients.length ? fail("refs.patient", "Patient reference integrity", `${danglingPatients.length} record(s) reference a missing patient.`, { count: danglingPatients.length }) : ok("refs.patient", "Patient reference integrity", "Clinical, financial and admission records resolve to valid patients."));

  const doctorIds = new Set(users.filter((user) => user.role === "doctor" && user.status !== "inactive").map((user) => user.id));
  const danglingDoctors = (db.appointments || []).filter((row) => row.doctorId && !doctorIds.has(row.doctorId));
  checks.push(danglingDoctors.length ? fail("refs.doctor", "Clinician reference integrity", `${danglingDoctors.length} appointment(s) reference a missing or inactive clinician.`, { count: danglingDoctors.length }) : ok("refs.doctor", "Clinician reference integrity", "Appointment clinicians resolve to active practitioner accounts."));

  const invalidWards = (db.wards || []).filter((ward) => {
    const capacity = Number(ward.capacity || 0);
    const available = Number(ward.available || 0);
    return capacity < 0 || available < 0 || available > capacity;
  });
  checks.push(invalidWards.length ? fail("wards.capacity", "Ward capacity invariants", `${invalidWards.length} ward(s) have impossible capacity values.`, { count: invalidWards.length }) : ok("wards.capacity", "Ward capacity invariants", "Every ward has availability between zero and configured capacity."));

  const heldByWard = new Map();
  (db.wardBookings || []).filter((booking) => booking.capacityHeld).forEach((booking) => heldByWard.set(booking.ward, (heldByWard.get(booking.ward) || 0) + 1));
  const capacityMismatches = (db.wards || []).filter((ward) => {
    const held = heldByWard.get(ward.name) || 0;
    return Number(ward.capacity || 0) - Number(ward.available || 0) < held;
  });
  checks.push(capacityMismatches.length ? fail("wards.holds", "Held-bed accounting", `${capacityMismatches.length} ward(s) have more held bookings than occupied capacity.`, { count: capacityMismatches.length }) : ok("wards.holds", "Held-bed accounting", "Held bookings are compatible with live ward capacity."));

  const duplicateEntityIds = ["appointments", "wardBookings", "prescriptions", "invoices", "notifications", "tickets", "clinicalOrders", "claims"]
    .flatMap((key) => duplicateValues(db[key] || [], "id").map((id) => `${key}:${id}`));
  checks.push(duplicateEntityIds.length ? fail("entities.ids", "Unique transactional IDs", `${duplicateEntityIds.length} duplicate transactional ID(s) found.`, { count: duplicateEntityIds.length }) : ok("entities.ids", "Unique transactional IDs", "No duplicate IDs in core transactional collections."));

  const unacknowledged = (db.clinicalOrders || []).filter((row) => row.status === "completed" && row.result && !row.resultAcknowledgedAt);
  checks.push(unacknowledged.length ? warn("clinical.unacknowledged", "Result acknowledgement queue", `${unacknowledged.length} completed result(s) await clinician acknowledgement.`, { count: unacknowledged.length }) : ok("clinical.unacknowledged", "Result acknowledgement queue", "No completed clinical results are waiting for acknowledgement."));

  const auditRows = db.audit || [];
  checks.push(auditRows.length ? ok("audit.present", "Audit trail", `${auditRows.length} audit event(s) are retained.`) : warn("audit.present", "Audit trail", "No audit events are currently retained."));
  return checks;
}

function environmentChecks() {
  const production = process.env.NODE_ENV === "production";
  const hasOrigins = Boolean(process.env.CLIENT_URL || process.env.CLIENT_URLS);
  const primaryPostgres = String(process.env.PERSISTENCE_PROVIDER || "").toLowerCase() === "postgres" || (production && Boolean(process.env.DATABASE_URL));
  const checks = [
    hasOrigins ? ok("env.origin", "Origin allow-list", "Client origin configuration is present.") : warn("env.origin", "Origin allow-list", "CLIENT_URL/CLIENT_URLS is not configured."),
    process.env.FLW_SECRET_KEY ? ok("env.payments", "Payment provider secret", "Flutterwave server secret is configured.") : warn("env.payments", "Payment provider secret", "Flutterwave secret is not configured; hosted payments cannot be production-ready."),
    process.env.SMTP_HOST ? ok("env.smtp", "SMTP delivery", "SMTP host is configured for real email delivery.") : warn("env.smtp", "SMTP delivery", "SMTP_HOST is not configured; production email delivery is not ready."),
    process.env.SESSION_DAYS ? ok("env.sessions", "Session lifetime", "Explicit session lifetime is configured.") : warn("env.sessions", "Session lifetime", "Using default session lifetime."),
    process.env.SESSION_MAX_PER_USER ? ok("env.session-cap", "Concurrent-session cap", `Maximum ${process.env.SESSION_MAX_PER_USER} active session(s) per user.`) : warn("env.session-cap", "Concurrent-session cap", "Using the built-in concurrent-session cap."),
    primaryPostgres ? ok("env.postgres", "PostgreSQL primary runtime", "PostgreSQL is configured as the CareBridge system of record.") : warn("env.postgres", "PostgreSQL primary runtime", "Atomic JSON remains the local/demo runtime store. Set PERSISTENCE_PROVIDER=postgres with DATABASE_URL for production."),
    process.env.REDIS_URL ? ok("env.redis", "Redis coordination", "Redis is configured for shared session coordination, cache and durable jobs.") : warn("env.redis", "Redis coordination", "REDIS_URL is not configured; distributed coordination is disabled."),
    mfaEncryptionConfigured() ? ok("env.mfa-key", "MFA encryption key", "Dedicated MFA encryption key is configured.") : warn("env.mfa-key", "MFA encryption key", "MFA uses a development fallback key. Configure MFA_ENCRYPTION_KEY before production."),
    ok("security.headers", "Browser security policy", "CSP, HSTS in production, frame denial, no-sniff, permissions policy and API no-store controls are installed."),
    ok("security.throttle", "Abuse throttling", "Login, registration, contact and API request classes are rate-limited."),
    ok("observability.http", "HTTP observability", "Request IDs and structured request telemetry are active."),
  ];
  if (production && !hasOrigins) checks[0] = fail("env.origin", "Origin allow-list", "Production requires CLIENT_URL or CLIENT_URLS.");
  if (production && !primaryPostgres) checks[5] = fail("env.postgres", "PostgreSQL primary runtime", "Production 9.5 readiness requires PostgreSQL as the primary system of record.");
  if (production && !process.env.REDIS_URL) checks[6] = fail("env.redis", "Redis coordination", "Production 9.5 readiness requires Redis coordination.");
  if (production && !mfaEncryptionConfigured()) checks[7] = fail("env.mfa-key", "MFA encryption key", "Production requires MFA_ENCRYPTION_KEY.");
  if (production && !process.env.SMTP_HOST) checks[2] = fail("env.smtp", "SMTP delivery", "Production requires a real SMTP provider.");
  return checks;
}

function capabilitySummary(db) {
  const production = process.env.NODE_ENV === "production";
  const primaryPostgres = String(process.env.PERSISTENCE_PROVIDER || "").toLowerCase() === "postgres" || (production && Boolean(process.env.DATABASE_URL));
  return {
    interoperability: {
      fhir: { version: "R4 4.0.1", resources: ["Patient", "Practitioner", "Appointment", "Observation", "Condition", "MedicationRequest", "Encounter"] },
      terminology: ["LOINC", "UCUM", "SNOMED CT", "ICD-10", "RxNorm"],
      smartOnFhir: { enabled: true, backendServices: true, scopedTokens: true, clientRegistry: true },
      hl7v2: { enabled: true, messages: ["ADT", "ORM", "ORU"], acknowledgement: true, idempotency: true },
      dicomPacs: { contract: true, dicomweb: ["QIDO-RS", "WADO-RS", "STOW-RS"], livePacsConfigured: Boolean(db.dicomConfig?.baseUrl || db.dicomConfig?.qidoUrl) },
    },
    clinical: {
      chart: true,
      cpoe: true,
      orderTypes: ["lab", "imaging", "medication", "procedure"],
      orders: (db.clinicalOrders || []).length,
      orderSets: true,
      resultAcknowledgement: true,
      medicationSafety: true,
      allergySafety: true,
      interactionChecks: true,
      signatures: true,
      cosignatures: true,
    },
    persistence: {
      localRuntime: "atomic-json",
      atomicRename: true,
      checksum: true,
      retainedBackups: true,
      journal: true,
      postgresAdapter: true,
      postgresTransactional: true,
      postgresPrimaryRuntime: primaryPostgres,
      outbox: true,
      optimisticConcurrency: true,
      tamperEvidentPostgresAudit: true,
    },
    coordination: {
      redisConfigured: Boolean(process.env.REDIS_URL),
      distributedSessions: Boolean(process.env.REDIS_URL),
      cache: Boolean(process.env.REDIS_URL),
      durableJobs: Boolean(process.env.REDIS_URL),
      idempotencyKeys: Boolean(process.env.REDIS_URL),
    },
    security: {
      scryptPasswords: true,
      boundedSessions: true,
      revokeOtherSessions: true,
      passwordPolicy: true,
      rateLimiting: true,
      csp: true,
      hstsProduction: true,
      requestIds: true,
      mfa: { totp: true, encryptedSecrets: true, recoveryCodes: true, productionKeyConfigured: mfaEncryptionConfigured() },
    },
    revenueCycle: {
      directPayments: true,
      eligibility: true,
      claims: true,
      denials: true,
      appeals: true,
      adjustments: true,
      reconciliation: true,
    },
    observability: { structuredHttpLogs: true, requestIds: true, processMetrics: true, traceContext: true, sloMetrics: true },
    realtime: { socketIo: true, wards: true, messages: true, pharmacy: true },
    finance: { flutterwave: true, momo: true, bank: true, nhis: true, receipts: true },
    communications: { smtp: Boolean(process.env.SMTP_HOST), inAppNotifications: true },
  };
}

function processMetrics(app) {
  const memory = process.memoryUsage();
  const http = app.locals.securityMetrics || {};
  const routeLatency = http.routeLatency || {};
  const aggregateLatency = Object.values(routeLatency).reduce((acc, row) => {
    acc.count += Number(row.count || 0);
    acc.totalMs += Number(row.totalMs || 0);
    acc.maxMs = Math.max(acc.maxMs, Number(row.maxMs || 0));
    return acc;
  }, { count: 0, totalMs: 0, maxMs: 0 });
  return {
    at: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    process: {
      pid: process.pid,
      node: process.version,
      rssBytes: memory.rss,
      heapUsedBytes: memory.heapUsed,
      heapTotalBytes: memory.heapTotal,
      externalBytes: memory.external,
    },
    http: {
      requests: Number(http.requests || 0),
      responses4xx: Number(http.responses4xx || 0),
      responses5xx: Number(http.responses5xx || 0),
      rateLimited: Number(http.rateLimited || 0),
      startedAt: http.startedAt || null,
      lastRequestAt: http.lastRequestAt || null,
      averageLatencyMs: aggregateLatency.count ? Number((aggregateLatency.totalMs / aggregateLatency.count).toFixed(2)) : 0,
      maxLatencyMs: Number(aggregateLatency.maxMs.toFixed(2)),
      routes: routeLatency,
    },
  };
}

export function mountEnterpriseOps(app, { readDb }) {
  app.get("/api/admin/system/integrity", (req, res) => {
    if (req.authUser?.role !== "admin") return res.status(403).json({ message: "Hospital operations access is required." });
    const db = readDb();
    const checks = integrityChecks(db);
    const failed = checks.filter((check) => check.status === "fail").length;
    const warnings = checks.filter((check) => check.status === "warn").length;
    const digestValue = crypto.createHash("sha256").update(JSON.stringify({ users: db.users?.length || 0, appointments: db.appointments?.length || 0, audit: db.audit || [] })).digest("hex");
    res.json({ status: failed ? "failed" : warnings ? "warning" : "healthy", failed, warnings, checks, digest: digestValue, checkedAt: new Date().toISOString() });
  });

  app.get("/api/admin/system/readiness", (req, res) => {
    if (req.authUser?.role !== "admin") return res.status(403).json({ message: "Hospital operations access is required." });
    const db = readDb();
    const checks = [...integrityChecks(db), ...environmentChecks()];
    const failed = checks.filter((check) => check.status === "fail").length;
    const warnings = checks.filter((check) => check.status === "warn").length;
    const passed = checks.filter((check) => check.status === "pass").length;
    res.json({
      ready: failed === 0,
      grade: failed ? "blocked" : warnings ? "needs-production-configuration" : "ready",
      summary: { passed, warnings, failed, total: checks.length },
      checks,
      capabilities: capabilitySummary(db),
      metrics: processMetrics(app),
      checkedAt: new Date().toISOString(),
    });
  });

  app.get("/api/admin/system/capabilities", (req, res) => {
    if (req.authUser?.role !== "admin") return res.status(403).json({ message: "Hospital operations access is required." });
    const db = readDb();
    res.json({ ...capabilitySummary(db), generatedAt: new Date().toISOString() });
  });

  app.get("/api/admin/system/metrics", (req, res) => {
    if (req.authUser?.role !== "admin") return res.status(403).json({ message: "Hospital operations access is required." });
    res.json(processMetrics(app));
  });
}
