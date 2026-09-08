import crypto from "crypto";

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
    ["prescriptions", db.prescriptions], ["invoices", db.invoices], ["clinical orders", db.clinicalOrders],
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

  const duplicateEntityIds = ["appointments", "wardBookings", "prescriptions", "invoices", "notifications", "tickets", "clinicalOrders"]
    .flatMap((key) => duplicateValues(db[key] || [], "id").map((id) => `${key}:${id}`));
  checks.push(duplicateEntityIds.length ? fail("entities.ids", "Unique transactional IDs", `${duplicateEntityIds.length} duplicate transactional ID(s) found.`, { count: duplicateEntityIds.length }) : ok("entities.ids", "Unique transactional IDs", "No duplicate IDs in core transactional collections."));

  const auditRows = db.audit || [];
  checks.push(auditRows.length ? ok("audit.present", "Audit trail", `${auditRows.length} audit event(s) are retained.`) : warn("audit.present", "Audit trail", "No audit events are currently retained."));
  return checks;
}

function environmentChecks() {
  const production = process.env.NODE_ENV === "production";
  const checks = [
    process.env.CLIENT_URL || process.env.CLIENT_URLS ? ok("env.origin", "Origin allow-list", "Client origin configuration is present.") : warn("env.origin", "Origin allow-list", "CLIENT_URL/CLIENT_URLS is not configured."),
    process.env.FLW_SECRET_KEY ? ok("env.payments", "Payment provider secret", "Flutterwave server secret is configured.") : warn("env.payments", "Payment provider secret", "Flutterwave secret is not configured; hosted payments cannot be production-ready."),
    process.env.SMTP_HOST ? ok("env.smtp", "SMTP delivery", "SMTP host is configured for real email delivery.") : warn("env.smtp", "SMTP delivery", "SMTP_HOST is not configured; production email delivery is not ready."),
    process.env.SESSION_DAYS ? ok("env.sessions", "Session lifetime", "Explicit session lifetime is configured.") : warn("env.sessions", "Session lifetime", "Using default session lifetime."),
  ];
  if (production && !process.env.CLIENT_URL && !process.env.CLIENT_URLS) checks[0] = fail("env.origin", "Origin allow-list", "Production requires CLIENT_URL or CLIENT_URLS.");
  return checks;
}

function capabilitySummary(db) {
  return {
    interoperability: {
      fhir: { version: "R4 4.0.1", resources: ["Patient", "Practitioner", "Appointment", "Observation", "Condition", "MedicationRequest", "Encounter"] },
      terminology: ["LOINC", "UCUM", "HL7 terminology"],
    },
    clinical: {
      chart: true,
      cpoe: true,
      orderTypes: ["lab", "imaging", "medication", "procedure"],
      orders: (db.clinicalOrders || []).length,
    },
    realtime: { socketIo: true, wards: true, messages: true, pharmacy: true },
    finance: { flutterwave: true, momo: true, bank: true, nhis: true, receipts: true },
    communications: { smtp: Boolean(process.env.SMTP_HOST), inAppNotifications: true },
  };
}

export function mountEnterpriseOps(app, { readDb }) {
  app.get("/api/admin/system/integrity", (req, res) => {
    if (req.authUser?.role !== "admin") return res.status(403).json({ message: "Hospital operations access is required." });
    const db = readDb();
    const checks = integrityChecks(db);
    const failed = checks.filter((check) => check.status === "fail").length;
    const warnings = checks.filter((check) => check.status === "warn").length;
    const digest = crypto.createHash("sha256").update(JSON.stringify({ users: db.users?.length || 0, appointments: db.appointments?.length || 0, audit: db.audit || [] })).digest("hex");
    res.json({ status: failed ? "failed" : warnings ? "warning" : "healthy", failed, warnings, checks, digest, checkedAt: new Date().toISOString() });
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
      checkedAt: new Date().toISOString(),
    });
  });

  app.get("/api/admin/system/capabilities", (req, res) => {
    if (req.authUser?.role !== "admin") return res.status(403).json({ message: "Hospital operations access is required." });
    const db = readDb();
    res.json({ ...capabilitySummary(db), generatedAt: new Date().toISOString() });
  });
}
