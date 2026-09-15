import crypto from "crypto";

const nid = (prefix) => `${prefix}_${crypto.randomUUID()}`;
const CLAIM_STATUSES = new Set(["draft", "submitted", "accepted", "denied", "appealed", "paid", "void"]);
const TRANSITIONS = {
  draft: new Set(["submitted", "void"]),
  submitted: new Set(["accepted", "denied", "void"]),
  accepted: new Set(["paid", "denied", "void"]),
  denied: new Set(["appealed", "void"]),
  appealed: new Set(["accepted", "denied", "void"]),
  paid: new Set(),
  void: new Set(),
};

function ensureState(db) {
  if (!Array.isArray(db.coverageChecks)) db.coverageChecks = [];
  if (!Array.isArray(db.claims)) db.claims = [];
  if (!Array.isArray(db.claimAdjustments)) db.claimAdjustments = [];
  if (!Array.isArray(db.claimReconciliations)) db.claimReconciliations = [];
  return db;
}

function patientFor(db, id) {
  return (db.users || []).find((user) => user.id === id && user.role === "patient");
}

function claimAmount(claim) {
  return (claim.lines || []).reduce((sum, line) => sum + Number(line.amount || 0), 0);
}

function validateLines(lines) {
  return Array.isArray(lines) && lines.length > 0 && lines.every((line) => String(line.description || "").trim() && Number(line.amount || 0) >= 0);
}

function audit(db, actorId, action, entityId, detail) {
  db.audit = db.audit || [];
  db.audit.unshift({ id: nid("au"), at: new Date().toISOString(), actorId, action, entity: "claim", entityId, detail });
}

function enrich(db, claim) {
  const patient = patientFor(db, claim.patientId) || {};
  return {
    ...claim,
    amount: claimAmount(claim),
    patient: { id: patient.id, name: patient.name, mrn: patient.mrn, insurance: patient.insurance },
    adjustments: (db.claimAdjustments || []).filter((row) => row.claimId === claim.id),
    reconciliations: (db.claimReconciliations || []).filter((row) => row.claimId === claim.id),
  };
}

export function mountRevenueCycle(app, { readDb, writeDb, notify }) {
  app.post("/api/coverage/eligibility", (req, res) => {
    if (!req.authUser) return res.status(401).json({ message: "Sign in to check coverage." });
    const db = readDb();
    ensureState(db);
    const patientId = req.authUser.role === "patient" ? req.authUser.id : String(req.body.patientId || "").trim();
    const patient = patientFor(db, patientId);
    if (!patient) return res.status(404).json({ message: "Patient not found." });
    const payer = String(req.body.payer || patient.insurance || "Self-pay").trim();
    const memberId = String(req.body.memberId || patient.insurance || "").trim();
    const eligible = Boolean(payer) && !/self[- ]?pay/i.test(payer) && Boolean(memberId);
    const row = {
      id: nid("elig"), patientId, payer, memberId,
      status: eligible ? "eligible" : "self-pay",
      benefits: eligible ? { outpatient: true, inpatient: true, pharmacy: true, priorAuthorizationRequired: false } : { outpatient: false, inpatient: false, pharmacy: false, priorAuthorizationRequired: false },
      checkedAt: new Date().toISOString(), checkedBy: req.authUser.id,
      source: process.env.ELIGIBILITY_API_URL ? "external-contract" : "carebridge-local-policy",
    };
    db.coverageChecks.push(row);
    writeDb(db);
    res.json(row);
  });

  app.get("/api/admin/claims", (req, res) => {
    if (req.authUser?.role !== "admin") return res.status(403).json({ message: "Hospital operations access is required." });
    const db = readDb();
    ensureState(db);
    let rows = db.claims.slice();
    if (req.query.status) rows = rows.filter((row) => row.status === req.query.status);
    if (req.query.patientId) rows = rows.filter((row) => row.patientId === req.query.patientId);
    rows.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    res.json(rows.map((row) => enrich(db, row)));
  });

  app.post("/api/admin/claims", (req, res) => {
    if (req.authUser?.role !== "admin") return res.status(403).json({ message: "Hospital operations access is required." });
    const db = readDb();
    ensureState(db);
    const patientId = String(req.body.patientId || "").trim();
    const patient = patientFor(db, patientId);
    if (!patient) return res.status(404).json({ message: "Patient not found." });
    const lines = Array.isArray(req.body.lines) ? req.body.lines.map((line) => ({
      id: line.id || nid("cln"),
      description: String(line.description || "").trim(),
      code: String(line.code || "").trim(),
      codeSystem: String(line.codeSystem || "").trim(),
      amount: Number(line.amount || 0),
      units: Math.max(1, Number(line.units || 1)),
    })) : [];
    if (!validateLines(lines)) return res.status(400).json({ message: "Add at least one valid claim line." });
    const claim = {
      id: nid("claim"), patientId,
      payer: String(req.body.payer || patient.insurance || "NHIS").trim(),
      memberId: String(req.body.memberId || patient.insurance || "").trim(),
      encounterId: String(req.body.encounterId || "").trim(),
      invoiceId: String(req.body.invoiceId || "").trim(),
      status: "draft", lines,
      diagnosisCodes: Array.isArray(req.body.diagnosisCodes) ? req.body.diagnosisCodes.map(String) : [],
      priorAuthorization: String(req.body.priorAuthorization || "").trim(),
      createdAt: new Date().toISOString(), createdBy: req.authUser.id,
      updatedAt: new Date().toISOString(), updatedBy: req.authUser.id,
      denialReason: "", appealNote: "", payerReference: "", paidAmount: 0,
    };
    db.claims.push(claim);
    audit(db, req.authUser.id, "claim.create", claim.id, `${claim.payer} claim for ${patientId}; GHS ${claimAmount(claim).toFixed(2)}`);
    writeDb(db);
    res.status(201).json(enrich(db, claim));
  });

  app.patch("/api/admin/claims/:id", (req, res) => {
    if (req.authUser?.role !== "admin") return res.status(403).json({ message: "Hospital operations access is required." });
    const db = readDb();
    ensureState(db);
    const claim = db.claims.find((row) => row.id === req.params.id);
    if (!claim) return res.status(404).json({ message: "Claim not found." });
    const next = req.body.status ? String(req.body.status).trim() : claim.status;
    if (!CLAIM_STATUSES.has(next)) return res.status(400).json({ message: "Invalid claim status." });
    if (next !== claim.status && !TRANSITIONS[claim.status]?.has(next)) return res.status(409).json({ message: `Claim cannot move from ${claim.status} to ${next}.` });
    if (next === "denied" && !String(req.body.denialReason || claim.denialReason || "").trim()) return res.status(400).json({ message: "A denial reason is required." });
    if (next === "appealed" && !String(req.body.appealNote || "").trim()) return res.status(400).json({ message: "Document the appeal before submission." });
    if (next === "paid") {
      const paidAmount = Number(req.body.paidAmount || 0);
      if (paidAmount <= 0) return res.status(400).json({ message: "Paid amount must be greater than zero." });
      claim.paidAmount = paidAmount;
      claim.paidAt = new Date().toISOString();
    }
    if (req.body.denialReason !== undefined) claim.denialReason = String(req.body.denialReason).trim();
    if (req.body.appealNote !== undefined) claim.appealNote = String(req.body.appealNote).trim();
    if (req.body.payerReference !== undefined) claim.payerReference = String(req.body.payerReference).trim();
    const previous = claim.status;
    claim.status = next;
    claim.updatedAt = new Date().toISOString();
    claim.updatedBy = req.authUser.id;
    audit(db, req.authUser.id, `claim.${next}`, claim.id, `${previous} → ${next}${claim.denialReason ? ` · ${claim.denialReason}` : ""}`);
    if (["denied", "paid"].includes(next)) notify(db, claim.patientId, next === "paid" ? "Insurance claim settled" : "Insurance claim needs review", next === "paid" ? "Your insurer has settled a CareBridge claim." : `A claim was denied: ${claim.denialReason}`);
    writeDb(db);
    res.json(enrich(db, claim));
  });

  app.post("/api/admin/claims/:id/adjustments", (req, res) => {
    if (req.authUser?.role !== "admin") return res.status(403).json({ message: "Hospital operations access is required." });
    const db = readDb();
    ensureState(db);
    const claim = db.claims.find((row) => row.id === req.params.id);
    if (!claim) return res.status(404).json({ message: "Claim not found." });
    const amount = Number(req.body.amount || 0);
    const reason = String(req.body.reason || "").trim();
    if (!amount || !reason) return res.status(400).json({ message: "Adjustment amount and reason are required." });
    const row = { id: nid("adj"), claimId: claim.id, amount, reason, type: amount < 0 ? "writeoff" : "charge", createdAt: new Date().toISOString(), createdBy: req.authUser.id };
    db.claimAdjustments.push(row);
    audit(db, req.authUser.id, "claim.adjust", claim.id, `${row.type} GHS ${Math.abs(amount).toFixed(2)} · ${reason}`);
    writeDb(db);
    res.status(201).json(row);
  });

  app.post("/api/admin/claims/:id/reconcile", (req, res) => {
    if (req.authUser?.role !== "admin") return res.status(403).json({ message: "Hospital operations access is required." });
    const db = readDb();
    ensureState(db);
    const claim = db.claims.find((row) => row.id === req.params.id);
    if (!claim) return res.status(404).json({ message: "Claim not found." });
    const paymentId = String(req.body.paymentId || "").trim();
    const payment = (db.payments || []).find((row) => row.id === paymentId || row.reference === paymentId);
    if (!payment) return res.status(404).json({ message: "Payment record not found." });
    const existing = db.claimReconciliations.find((row) => row.claimId === claim.id && row.paymentId === payment.id);
    if (existing) return res.json(existing);
    const row = { id: nid("recon"), claimId: claim.id, paymentId: payment.id, amount: Number(req.body.amount || payment.amount || 0), reconciledAt: new Date().toISOString(), reconciledBy: req.authUser.id };
    db.claimReconciliations.push(row);
    audit(db, req.authUser.id, "claim.reconcile", claim.id, `Payment ${payment.id} matched for GHS ${row.amount.toFixed(2)}`);
    writeDb(db);
    res.status(201).json(row);
  });
}
