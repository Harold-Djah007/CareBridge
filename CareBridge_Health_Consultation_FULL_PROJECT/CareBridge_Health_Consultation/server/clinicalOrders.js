import { evaluateMedicationSafety } from "./clinicalSafety.js";

const ORDER_TYPES = new Set(["lab", "imaging", "medication", "procedure"]);
const ORDER_STATUSES = new Set(["draft", "active", "in_progress", "completed", "cancelled"]);
const TRANSITIONS = {
  draft: new Set(["active", "cancelled"]),
  active: new Set(["in_progress", "completed", "cancelled"]),
  in_progress: new Set(["completed", "cancelled"]),
  completed: new Set(),
  cancelled: new Set(),
};

const nid = (prefix) => `${prefix}${Date.now()}${Math.floor(Math.random() * 900)}`;
const cleanText = (value, fallback = "") => String(value ?? fallback).trim();

function ensureOrders(db) {
  if (!Array.isArray(db.clinicalOrders)) db.clinicalOrders = [];
  if (!Array.isArray(db.diagnosticReports)) db.diagnosticReports = [];
  if (!Array.isArray(db.labs)) db.labs = [];
  if (!Array.isArray(db.safetyOverrides)) db.safetyOverrides = [];
  return db.clinicalOrders;
}

function patientFor(db, patientId) {
  return (db.users || []).find((user) => user.id === patientId && user.role === "patient" && user.status !== "inactive");
}

function clinicianFor(db, userId) {
  return (db.users || []).find((user) => user.id === userId && ["doctor", "nurse", "admin"].includes(user.role) && user.status !== "inactive");
}

function canRead(req, order) {
  if (!req.authUser) return false;
  if (req.authUser.role === "patient") return order.patientId === req.authUser.id;
  return ["doctor", "nurse", "admin"].includes(req.authUser.role);
}

function enrich(db, order, safeUser) {
  return {
    ...order,
    patient: safeUser(patientFor(db, order.patientId) || {}),
    orderedBy: safeUser(clinicianFor(db, order.orderedById) || {}),
    lastUpdatedBy: safeUser(clinicianFor(db, order.lastUpdatedById) || {}),
    resultAcknowledgedBy: order.resultAcknowledgedById ? safeUser(clinicianFor(db, order.resultAcknowledgedById) || {}) : null,
  };
}

function validateCode(type, body) {
  const code = cleanText(body.code);
  const codeSystem = cleanText(body.codeSystem);
  if (code && !codeSystem) {
    return type === "lab" ? "Add the coding system for the laboratory order, such as LOINC." : "Add a coding system when an order code is supplied.";
  }
  return "";
}

function writeAudit(db, entry) {
  db.audit = db.audit || [];
  db.audit.unshift({
    id: nid("au"),
    at: new Date().toISOString(),
    actorId: entry.actorId || "",
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId || "",
    detail: entry.detail || "",
  });
}

function fileCompletedResult(db, order, actor) {
  if (order.status !== "completed" || !order.result || order.resultRecordId) return null;
  const date = new Date().toISOString().slice(0, 10);

  if (order.type === "lab") {
    const record = {
      id: nid("lab"),
      patientId: order.patientId,
      orderId: order.id,
      name: order.title,
      code: order.code || "",
      codeSystem: order.codeSystem || "",
      date,
      status: "final",
      result: order.result,
      flag: order.resultFlag || "review",
      orderedBy: clinicianFor(db, order.orderedById)?.name || "CareBridge clinician",
      resultedBy: actor?.name || "Clinical team",
      acknowledgedAt: null,
    };
    db.labs.push(record);
    order.resultRecordId = record.id;
    order.resultResourceType = "Observation";
    return record;
  }

  if (order.type === "imaging") {
    const report = {
      id: nid("dr"),
      patientId: order.patientId,
      orderId: order.id,
      title: order.title,
      code: order.code || "",
      codeSystem: order.codeSystem || "",
      date,
      status: "final",
      result: order.result,
      flag: order.resultFlag || "review",
      bodySite: order.bodySite || "",
      orderedBy: clinicianFor(db, order.orderedById)?.name || "CareBridge clinician",
      resultedBy: actor?.name || "Clinical team",
      acknowledgedAt: null,
    };
    db.diagnosticReports.push(report);
    order.resultRecordId = report.id;
    order.resultResourceType = "DiagnosticReport";
    return report;
  }
  return null;
}

export function mountClinicalOrders(app, { readDb, writeDb, safeUser, notify, emailPatient }) {
  app.get("/api/orders", (req, res) => {
    const db = readDb();
    let rows = ensureOrders(db).slice();
    if (req.authUser?.role === "patient") rows = rows.filter((order) => order.patientId === req.authUser.id);
    else if (req.query.patientId) rows = rows.filter((order) => order.patientId === req.query.patientId);
    if (req.query.type) rows = rows.filter((order) => order.type === req.query.type);
    if (req.query.status) rows = rows.filter((order) => order.status === req.query.status);
    if (req.query.unacknowledged === "1") rows = rows.filter((order) => order.status === "completed" && order.result && !order.resultAcknowledgedAt);
    rows.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    res.json(rows.map((order) => enrich(db, order, safeUser)));
  });

  app.get("/api/orders/:id", (req, res) => {
    const db = readDb();
    const order = ensureOrders(db).find((item) => item.id === req.params.id);
    if (!order) return res.status(404).json({ message: "Clinical order not found." });
    if (!canRead(req, order)) return res.status(403).json({ message: "You cannot open this clinical order." });
    res.json(enrich(db, order, safeUser));
  });

  app.post("/api/orders", async (req, res) => {
    if (!req.authUser || !["doctor", "admin"].includes(req.authUser.role)) {
      return res.status(403).json({ message: "Only clinicians or hospital operations can place clinical orders." });
    }
    const type = cleanText(req.body.type).toLowerCase();
    if (!ORDER_TYPES.has(type)) return res.status(400).json({ message: "Order type must be lab, imaging, medication, or procedure." });
    const patientId = cleanText(req.body.patientId);
    const title = cleanText(req.body.title);
    if (!patientId || !title) return res.status(400).json({ message: "Choose a patient and enter an order name." });

    const db = readDb();
    const patient = patientFor(db, patientId);
    if (!patient) return res.status(404).json({ message: "Patient account not found." });
    const codeError = validateCode(type, req.body);
    if (codeError) return res.status(400).json({ message: codeError });

    ensureOrders(db);
    const safety = type === "medication" ? evaluateMedicationSafety(db, patientId, title) : { safe: true, warnings: [], checkedAt: null };
    const overrideReason = cleanText(req.body.safetyOverrideReason);
    if (!safety.safe && !overrideReason) {
      return res.status(409).json({
        message: "A high-severity medication safety warning must be reviewed before this order can be placed.",
        code: "CLINICAL_SAFETY_BLOCK",
        safety,
      });
    }

    const now = new Date().toISOString();
    const order = {
      id: nid("ord"),
      patientId,
      type,
      title,
      code: cleanText(req.body.code),
      codeSystem: cleanText(req.body.codeSystem),
      priority: ["routine", "urgent", "stat"].includes(req.body.priority) ? req.body.priority : "routine",
      status: req.body.status === "draft" ? "draft" : "active",
      instructions: cleanText(req.body.instructions),
      clinicalReason: cleanText(req.body.clinicalReason),
      specimen: type === "lab" ? cleanText(req.body.specimen) : "",
      bodySite: cleanText(req.body.bodySite),
      orderedById: req.authUser.id,
      lastUpdatedById: req.authUser.id,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
      result: "",
      resultCode: "",
      resultCodeSystem: "",
      resultFlag: "",
      resultRecordId: null,
      resultResourceType: null,
      resultAcknowledgedAt: null,
      resultAcknowledgedById: null,
      safetyAssessment: safety,
      safetyOverrideReason: overrideReason || "",
    };
    db.clinicalOrders.push(order);
    writeAudit(db, { actorId: req.authUser.id, action: "order.create", entity: "clinical-order", entityId: order.id, detail: `${type}: ${title} for ${patientId}` });
    if (!safety.safe && overrideReason) {
      db.safetyOverrides.push({ id: nid("sov"), orderId: order.id, patientId, warnings: safety.warnings, reason: overrideReason, actorId: req.authUser.id, createdAt: now });
      writeAudit(db, { actorId: req.authUser.id, action: "safety.override", entity: "clinical-order", entityId: order.id, detail: overrideReason });
    }
    if (order.status === "active") {
      notify(db, patientId, `${type === "lab" ? "Lab" : type === "imaging" ? "Imaging" : type === "medication" ? "Medication" : "Procedure"} order placed`, `${title} was added to your care plan.`);
      await emailPatient(db, patientId, {
        type: "clinical",
        subject: `CareBridge clinical order · ${title}`,
        heading: "A new clinical order was placed",
        intro: `${req.authUser.name || "Your clinician"} added ${title} to your care plan.`,
        details: [
          ["Order", title],
          ["Type", type],
          ["Priority", order.priority],
          ...(order.instructions ? [["Instructions", order.instructions]] : []),
        ],
        closing: "Open your Health record in CareBridge for the latest clinical updates.",
      });
    }
    writeDb(db);
    res.status(201).json(enrich(db, order, safeUser));
  });

  app.patch("/api/orders/:id", async (req, res) => {
    if (!req.authUser || !["doctor", "nurse", "admin"].includes(req.authUser.role)) {
      return res.status(403).json({ message: "Clinical staff access is required." });
    }
    const db = readDb();
    const order = ensureOrders(db).find((item) => item.id === req.params.id);
    if (!order) return res.status(404).json({ message: "Clinical order not found." });

    const nextStatus = req.body.status ? cleanText(req.body.status).toLowerCase() : order.status;
    if (!ORDER_STATUSES.has(nextStatus)) return res.status(400).json({ message: "Invalid clinical order status." });
    if (nextStatus !== order.status && !TRANSITIONS[order.status]?.has(nextStatus)) {
      return res.status(409).json({ message: `Clinical order cannot move from ${order.status} to ${nextStatus}.` });
    }
    if (req.authUser.role === "nurse" && order.type === "medication" && nextStatus === "cancelled") {
      return res.status(403).json({ message: "Medication orders must be cancelled by a prescriber or hospital operations." });
    }

    const resultFields = ["result", "resultCode", "resultCodeSystem", "resultFlag"];
    resultFields.forEach((key) => {
      if (req.body[key] !== undefined) order[key] = cleanText(req.body[key]);
    });
    if (req.body.instructions !== undefined && ["doctor", "admin"].includes(req.authUser.role)) order.instructions = cleanText(req.body.instructions);
    if (req.body.priority !== undefined && ["routine", "urgent", "stat"].includes(req.body.priority) && ["doctor", "admin"].includes(req.authUser.role)) order.priority = req.body.priority;

    const statusChanged = nextStatus !== order.status;
    order.status = nextStatus;
    order.lastUpdatedById = req.authUser.id;
    order.updatedAt = new Date().toISOString();
    if (nextStatus === "completed") order.completedAt = order.completedAt || order.updatedAt;

    const resultRecord = fileCompletedResult(db, order, req.authUser);
    writeAudit(db, { actorId: req.authUser.id, action: statusChanged ? `order.${nextStatus}` : "order.update", entity: "clinical-order", entityId: order.id, detail: `${order.type}: ${order.title}` });
    if (resultRecord) writeAudit(db, { actorId: req.authUser.id, action: "result.file", entity: order.resultResourceType === "DiagnosticReport" ? "diagnostic-report" : "lab-result", entityId: resultRecord.id, detail: `${order.title} result filed from ${order.id}` });

    if (statusChanged && ["completed", "cancelled"].includes(nextStatus)) {
      notify(db, order.patientId, nextStatus === "completed" ? "Clinical result available" : "Clinical order cancelled", nextStatus === "completed" ? `${order.title} is complete${order.result ? `: ${order.result}` : "."}` : `${order.title} was cancelled.`);
      await emailPatient(db, order.patientId, {
        type: "clinical",
        subject: `${order.title} · ${nextStatus}`,
        heading: nextStatus === "completed" ? "Clinical result available" : "Clinical order cancelled",
        intro: nextStatus === "completed" ? `${order.title} has been completed.` : `${order.title} has been cancelled by your care team.`,
        details: [
          ["Order", order.title],
          ["Status", nextStatus],
          ...(order.result ? [["Result", order.result]] : []),
        ],
      });
    }

    writeDb(db);
    res.json(enrich(db, order, safeUser));
  });
}
