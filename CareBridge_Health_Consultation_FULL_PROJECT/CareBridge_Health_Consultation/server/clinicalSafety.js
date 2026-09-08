import crypto from "crypto";

const nid = (prefix) => `${prefix}_${crypto.randomUUID()}`;

const ORDER_SETS = [
  {
    id: "os-hypertension-review",
    name: "Hypertension review",
    indication: "Routine or escalated hypertension assessment",
    version: "2026.1",
    orders: [
      { type: "lab", title: "Renal function panel", code: "24362-6", codeSystem: "http://loinc.org", priority: "routine", specimen: "Venous blood" },
      { type: "lab", title: "Lipid panel", code: "57698-3", codeSystem: "http://loinc.org", priority: "routine", specimen: "Venous blood" },
      { type: "procedure", title: "12-lead ECG", code: "34534-8", codeSystem: "http://loinc.org", priority: "routine" },
    ],
  },
  {
    id: "os-febrile-adult",
    name: "Adult fever assessment",
    indication: "Acute undifferentiated fever",
    version: "2026.1",
    orders: [
      { type: "lab", title: "Full blood count", code: "58410-2", codeSystem: "http://loinc.org", priority: "urgent", specimen: "Venous blood" },
      { type: "lab", title: "Malaria rapid diagnostic test", code: "70569-9", codeSystem: "http://loinc.org", priority: "urgent", specimen: "Capillary blood" },
    ],
  },
  {
    id: "os-preop-basic",
    name: "Pre-operative basic panel",
    indication: "Pre-operative review before elective procedure",
    version: "2026.1",
    orders: [
      { type: "lab", title: "Full blood count", code: "58410-2", codeSystem: "http://loinc.org", priority: "routine", specimen: "Venous blood" },
      { type: "lab", title: "Renal function panel", code: "24362-6", codeSystem: "http://loinc.org", priority: "routine", specimen: "Venous blood" },
      { type: "imaging", title: "Chest radiograph", code: "36643-5", codeSystem: "http://loinc.org", priority: "routine", bodySite: "Chest" },
    ],
  },
];

const INTERACTIONS = [
  { a: "warfarin", b: "ibuprofen", severity: "high", message: "NSAIDs can increase bleeding risk with warfarin." },
  { a: "warfarin", b: "aspirin", severity: "high", message: "Combined anticoagulant/antiplatelet therapy increases bleeding risk." },
  { a: "amlodipine", b: "clarithromycin", severity: "moderate", message: "Clarithromycin may increase amlodipine exposure and hypotension risk." },
  { a: "lisinopril", b: "spironolactone", severity: "moderate", message: "Combined RAAS blockade can increase potassium; monitor renal function and potassium." },
];

function ensureState(db) {
  if (!Array.isArray(db.resultAcknowledgements)) db.resultAcknowledgements = [];
  if (!Array.isArray(db.clinicalSignatures)) db.clinicalSignatures = [];
  if (!Array.isArray(db.safetyOverrides)) db.safetyOverrides = [];
  if (!Array.isArray(db.clinicalOrders)) db.clinicalOrders = [];
  return db;
}

const normalize = (value) => String(value || "").toLowerCase();

export function evaluateMedicationSafety(db, patientId, medicationName) {
  const patient = (db.users || []).find((user) => user.id === patientId && user.role === "patient");
  const medication = normalize(medicationName);
  const allergies = normalize(patient?.allergies);
  const activeMeds = (db.medications || [])
    .filter((row) => row.patientId === patientId && row.status !== "stopped" && row.status !== "cancelled")
    .map((row) => normalize(row.name));
  const prescriptionMeds = (db.prescriptions || [])
    .filter((row) => row.patientId === patientId && !["cancelled", "stopped"].includes(row.status))
    .flatMap((row) => Array.isArray(row.items) ? row.items.map((item) => normalize(item.drug)) : [normalize(row.drug)]);
  const warnings = [];

  const allergyRules = [
    { terms: ["penicillin"], meds: ["amoxicillin", "ampicillin", "penicillin"], severity: "high", message: "Recorded penicillin allergy may conflict with this beta-lactam medicine." },
    { terms: ["nsaid", "ibuprofen", "aspirin"], meds: ["ibuprofen", "aspirin", "diclofenac", "naproxen"], severity: "high", message: "Recorded NSAID/aspirin allergy may conflict with this medicine." },
    { terms: ["sulfa", "sulfonamide"], meds: ["sulfamethoxazole", "co-trimoxazole", "trimethoprim-sulfamethoxazole"], severity: "high", message: "Recorded sulfonamide allergy may conflict with this medicine." },
  ];
  allergyRules.forEach((rule) => {
    if (rule.terms.some((term) => allergies.includes(term)) && rule.meds.some((term) => medication.includes(term))) warnings.push({ type: "allergy", ...rule });
  });

  const allCurrent = [...activeMeds, ...prescriptionMeds];
  INTERACTIONS.forEach((rule) => {
    const newIsA = medication.includes(rule.a);
    const newIsB = medication.includes(rule.b);
    const counterpart = newIsA ? rule.b : newIsB ? rule.a : "";
    if (counterpart && allCurrent.some((name) => name.includes(counterpart))) warnings.push({ type: "interaction", ...rule, counterpart });
  });

  return {
    safe: !warnings.some((warning) => warning.severity === "high"),
    warnings,
    checkedAt: new Date().toISOString(),
  };
}

function clinician(db, id) {
  return (db.users || []).find((user) => user.id === id && ["doctor", "nurse", "admin"].includes(user.role) && user.status !== "inactive");
}

function signPayload(payload, signerId) {
  const at = new Date().toISOString();
  const digest = crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
  const signatureHash = crypto.createHash("sha256").update(`${digest}:${signerId}:${at}`).digest("hex");
  return { digest, signatureHash, at };
}

export function mountClinicalSafety(app, { readDb, writeDb, safeUser, notify }) {
  app.get("/api/clinical/order-sets", (req, res) => {
    if (!req.authUser || !["doctor", "nurse", "admin"].includes(req.authUser.role)) return res.status(403).json({ message: "Clinical staff access is required." });
    res.json(ORDER_SETS);
  });

  app.post("/api/clinical/order-sets/:id/apply", (req, res) => {
    if (!req.authUser || !["doctor", "admin"].includes(req.authUser.role)) return res.status(403).json({ message: "Only prescribers or hospital operations can apply order sets." });
    const set = ORDER_SETS.find((item) => item.id === req.params.id);
    if (!set) return res.status(404).json({ message: "Order set not found." });
    const db = readDb();
    ensureState(db);
    const patientId = String(req.body.patientId || "").trim();
    const patient = (db.users || []).find((user) => user.id === patientId && user.role === "patient" && user.status !== "inactive");
    if (!patient) return res.status(404).json({ message: "Patient not found." });
    const now = new Date().toISOString();
    const created = set.orders.map((template) => ({
      id: nid("ord"), patientId, ...template,
      status: "active",
      clinicalReason: String(req.body.clinicalReason || set.indication),
      instructions: "",
      orderedById: req.authUser.id,
      lastUpdatedById: req.authUser.id,
      createdAt: now, updatedAt: now, completedAt: null,
      result: "", resultCode: "", resultCodeSystem: "", resultFlag: "", resultRecordId: null, resultResourceType: null,
      orderSetId: set.id, orderSetVersion: set.version,
    }));
    db.clinicalOrders.push(...created);
    db.audit = db.audit || [];
    db.audit.unshift({ id: nid("au"), at: now, actorId: req.authUser.id, action: "orderset.apply", entity: "order-set", entityId: set.id, detail: `${set.name} applied to ${patientId}; ${created.length} order(s)` });
    notify(db, patientId, "Clinical plan updated", `${set.name} was added to your care plan.`);
    writeDb(db);
    res.status(201).json({ orderSet: set, orders: created });
  });

  app.post("/api/clinical/medication-safety", (req, res) => {
    if (!req.authUser || !["doctor", "nurse", "admin"].includes(req.authUser.role)) return res.status(403).json({ message: "Clinical staff access is required." });
    const db = readDb();
    res.json(evaluateMedicationSafety(db, req.body.patientId, req.body.medication));
  });

  app.post("/api/orders/:id/acknowledge", (req, res) => {
    if (!req.authUser || !["doctor", "admin"].includes(req.authUser.role)) return res.status(403).json({ message: "A prescriber or hospital operations clinician must acknowledge results." });
    const db = readDb();
    ensureState(db);
    const order = db.clinicalOrders.find((row) => row.id === req.params.id);
    if (!order) return res.status(404).json({ message: "Clinical order not found." });
    if (order.status !== "completed" || !order.result) return res.status(409).json({ message: "Only completed orders with a result can be acknowledged." });
    if (order.resultAcknowledgedAt) return res.json(order);
    const row = { id: nid("ack"), orderId: order.id, patientId: order.patientId, acknowledgedById: req.authUser.id, acknowledgedAt: new Date().toISOString(), note: String(req.body.note || "").trim() };
    db.resultAcknowledgements.push(row);
    order.resultAcknowledgedAt = row.acknowledgedAt;
    order.resultAcknowledgedById = req.authUser.id;
    order.resultAcknowledgementId = row.id;
    db.audit = db.audit || [];
    db.audit.unshift({ id: nid("au"), at: row.acknowledgedAt, actorId: req.authUser.id, action: "result.acknowledge", entity: "clinical-order", entityId: order.id, detail: row.note || order.title });
    writeDb(db);
    res.json(order);
  });

  app.post("/api/notes/:id/sign", (req, res) => {
    if (!req.authUser || !["doctor", "admin"].includes(req.authUser.role)) return res.status(403).json({ message: "Clinical signing authority is required." });
    const db = readDb();
    ensureState(db);
    const note = (db.notes || []).find((row) => row.id === req.params.id);
    if (!note) return res.status(404).json({ message: "Clinical note not found." });
    if (req.authUser.role !== "admin" && note.authorId && note.authorId !== req.authUser.id) return res.status(403).json({ message: "Clinicians can sign their own note; operations may sign administratively." });
    if (note.signedAt) return res.json(note);
    const signed = signPayload({ subjective: note.subjective, objective: note.objective, assessment: note.assessment, plan: note.plan }, req.authUser.id);
    const signature = { id: nid("sig"), noteId: note.id, patientId: note.patientId, signerId: req.authUser.id, signerRole: req.authUser.role, type: "author", ...signed };
    db.clinicalSignatures.push(signature);
    note.signedAt = signed.at;
    note.signedById = req.authUser.id;
    note.signatureId = signature.id;
    note.signatureHash = signature.signatureHash;
    writeDb(db);
    res.json(note);
  });

  app.post("/api/notes/:id/cosign", (req, res) => {
    if (!req.authUser || !["doctor", "admin"].includes(req.authUser.role)) return res.status(403).json({ message: "Clinical co-signing authority is required." });
    const db = readDb();
    ensureState(db);
    const note = (db.notes || []).find((row) => row.id === req.params.id);
    if (!note) return res.status(404).json({ message: "Clinical note not found." });
    if (!note.signedAt) return res.status(409).json({ message: "The author must sign the note before co-signature." });
    if (note.signedById === req.authUser.id) return res.status(409).json({ message: "The co-signer must be different from the original signer." });
    if (note.cosignedAt) return res.json(note);
    const signed = signPayload({ noteId: note.id, authorSignature: note.signatureHash, attestation: String(req.body.attestation || "Reviewed and co-signed") }, req.authUser.id);
    const signature = { id: nid("sig"), noteId: note.id, patientId: note.patientId, signerId: req.authUser.id, signerRole: req.authUser.role, type: "cosign", attestation: String(req.body.attestation || "Reviewed and co-signed"), ...signed };
    db.clinicalSignatures.push(signature);
    note.cosignedAt = signed.at;
    note.cosignedById = req.authUser.id;
    note.cosignatureId = signature.id;
    note.cosignatureHash = signature.signatureHash;
    writeDb(db);
    res.json(note);
  });

  app.get("/api/clinical/signatures/:noteId", (req, res) => {
    if (!req.authUser || !["doctor", "nurse", "admin"].includes(req.authUser.role)) return res.status(403).json({ message: "Clinical staff access is required." });
    const db = readDb();
    ensureState(db);
    res.json(db.clinicalSignatures.filter((row) => row.noteId === req.params.noteId).map((row) => ({ ...row, signer: safeUser(clinician(db, row.signerId) || {}) })));
  });
}
