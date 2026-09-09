import crypto from "crypto";

const HL7_TYPES = new Set(["ADT", "ORM", "ORU"]);
const nid = (prefix) => `${prefix}_${crypto.randomUUID()}`;

const TERMINOLOGY = [
  { system: "http://loinc.org", code: "58410-2", display: "Complete blood count panel - Blood by Automated count" },
  { system: "http://loinc.org", code: "85353-1", display: "Vital signs, weight, height, head circumference, oxygen saturation and BMI panel" },
  { system: "http://loinc.org", code: "8867-4", display: "Heart rate" },
  { system: "http://loinc.org", code: "8310-5", display: "Body temperature" },
  { system: "http://snomed.info/sct", code: "38341003", display: "Hypertensive disorder, systemic arterial" },
  { system: "http://snomed.info/sct", code: "25064002", display: "Headache" },
  { system: "http://hl7.org/fhir/sid/icd-10", code: "I10", display: "Essential (primary) hypertension" },
  { system: "http://hl7.org/fhir/sid/icd-10", code: "R51", display: "Headache" },
  { system: "http://www.nlm.nih.gov/research/umls/rxnorm", code: "329526", display: "Amlodipine 5 MG Oral Tablet" },
  { system: "http://www.nlm.nih.gov/research/umls/rxnorm", code: "198440", display: "Acetaminophen 500 MG Oral Tablet" },
];

function ensureState(db) {
  if (!Array.isArray(db.hl7Messages)) db.hl7Messages = [];
  if (!Array.isArray(db.dicomStudies)) db.dicomStudies = [];
  if (!db.dicomConfig || typeof db.dicomConfig !== "object") db.dicomConfig = {};
  return db;
}

function parseHl7(message) {
  const normalized = String(message || "").replace(/\r?\n/g, "\r").trim();
  const segments = normalized.split("\r").filter(Boolean).map((line) => line.split("|"));
  const byName = new Map();
  segments.forEach((fields) => {
    const key = fields[0];
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key).push(fields);
  });
  const msh = byName.get("MSH")?.[0];
  if (!msh) throw new Error("HL7 message must contain an MSH segment.");
  const messageField = msh[8] || "";
  const [messageType, triggerEvent] = messageField.split("^");
  if (!HL7_TYPES.has(messageType)) throw new Error("CareBridge accepts ADT, ORM, and ORU HL7 v2 messages.");
  const pid = byName.get("PID")?.[0] || [];
  const pv1 = byName.get("PV1")?.[0] || [];
  const obr = byName.get("OBR")?.[0] || [];
  const obxRows = byName.get("OBX") || [];
  return {
    raw: normalized,
    version: msh[11] || "2.x",
    sendingApplication: msh[2] || "",
    sendingFacility: msh[3] || "",
    receivingApplication: msh[4] || "",
    receivingFacility: msh[5] || "",
    timestamp: msh[6] || "",
    messageType,
    triggerEvent: triggerEvent || "",
    controlId: msh[9] || "",
    patient: {
      externalId: pid[3]?.split("^")?.[0] || "",
      name: [pid[5]?.split("^")?.[1], pid[5]?.split("^")?.[0]].filter(Boolean).join(" "),
      dob: pid[7] || "",
      sex: pid[8] || "",
    },
    encounter: { visitNumber: pv1[19] || "", location: pv1[3] || "", patientClass: pv1[2] || "" },
    order: { placerOrderNumber: obr[2] || "", fillerOrderNumber: obr[3] || "", universalServiceId: obr[4] || "" },
    observations: obxRows.map((row) => ({ setId: row[1] || "", valueType: row[2] || "", identifier: row[3] || "", value: row[5] || "", units: row[6] || "", referenceRange: row[7] || "", abnormalFlags: row[8] || "", status: row[11] || "" })),
  };
}

function ackFor(parsed, code = "AA", text = "Accepted") {
  const now = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  return [
    `MSH|^~\\&|CareBridge|Ridge|${parsed.sendingApplication || "SOURCE"}|${parsed.sendingFacility || "SOURCE"}|${now}||ACK^${parsed.triggerEvent || ""}|ACK${Date.now()}|P|2.5.1`,
    `MSA|${code}|${parsed.controlId || "UNKNOWN"}|${text}`,
  ].join("\r");
}

function dicomEndpoint(config, kind) {
  const explicit = config?.[kind];
  if (explicit) return explicit;
  const base = String(config?.baseUrl || "").replace(/\/$/, "");
  if (!base) return "";
  if (kind === "qidoUrl") return `${base}/studies`;
  if (kind === "wadoUrl") return `${base}/studies`;
  if (kind === "stowUrl") return `${base}/studies`;
  return base;
}

export function mountInterop(app, { readDb, writeDb }) {
  app.get("/api/terminology/lookup", (req, res) => {
    const system = String(req.query.system || "").trim();
    const code = String(req.query.code || "").trim();
    const text = String(req.query.text || "").trim().toLowerCase();
    let rows = TERMINOLOGY.slice();
    if (system) rows = rows.filter((row) => row.system === system);
    if (code) rows = rows.filter((row) => row.code.toLowerCase() === code.toLowerCase());
    if (text) rows = rows.filter((row) => row.display.toLowerCase().includes(text) || row.code.toLowerCase().includes(text));
    res.json({ total: rows.length, concepts: rows.slice(0, 25), source: "CareBridge validated starter terminology; configure an external terminology server for full production vocabularies." });
  });

  app.get("/api/admin/integrations/hl7", (req, res) => {
    if (req.authUser?.role !== "admin") return res.status(403).json({ message: "Hospital operations access is required." });
    const db = readDb();
    ensureState(db);
    res.json({ supported: ["ADT", "ORM", "ORU"], messages: db.hl7Messages.slice(-100).reverse() });
  });

  app.post("/api/admin/integrations/hl7/v2/ingest", (req, res) => {
    if (req.authUser?.role !== "admin") return res.status(403).json({ message: "Hospital operations access is required." });
    let parsed;
    try { parsed = parseHl7(req.body.message || req.body.raw); }
    catch (error) { return res.status(400).json({ message: error.message }); }
    const db = readDb();
    ensureState(db);
    if (parsed.controlId) {
      const existing = db.hl7Messages.find((row) => row.controlId === parsed.controlId && row.sendingFacility === parsed.sendingFacility);
      if (existing) return res.json({ duplicate: true, record: existing, ack: ackFor(parsed, "AA", "Duplicate already accepted") });
    }
    const record = {
      id: nid("hl7"),
      ...parsed,
      raw: parsed.raw,
      status: "accepted",
      receivedAt: new Date().toISOString(),
      receivedBy: req.authUser.id,
    };
    db.hl7Messages.push(record);
    writeDb(db);
    res.status(202).json({ duplicate: false, record, ack: ackFor(parsed) });
  });

  app.get("/api/admin/integrations/dicom", (req, res) => {
    if (req.authUser?.role !== "admin") return res.status(403).json({ message: "Hospital operations access is required." });
    const db = readDb();
    ensureState(db);
    const config = db.dicomConfig;
    res.json({
      config: { ...config, qidoUrl: dicomEndpoint(config, "qidoUrl"), wadoUrl: dicomEndpoint(config, "wadoUrl"), stowUrl: dicomEndpoint(config, "stowUrl") },
      studies: db.dicomStudies.slice(-100).reverse(),
      contract: { standards: ["DICOMweb QIDO-RS", "WADO-RS", "STOW-RS"], authentication: ["Bearer", "mTLS via gateway"] },
    });
  });

  app.patch("/api/admin/integrations/dicom", (req, res) => {
    if (req.authUser?.role !== "admin") return res.status(403).json({ message: "Hospital operations access is required." });
    const db = readDb();
    ensureState(db);
    const allowed = ["name", "aeTitle", "baseUrl", "qidoUrl", "wadoUrl", "stowUrl", "authMode"];
    allowed.forEach((key) => { if (req.body[key] !== undefined) db.dicomConfig[key] = String(req.body[key]).trim(); });
    db.dicomConfig.updatedAt = new Date().toISOString();
    db.dicomConfig.updatedBy = req.authUser.id;
    writeDb(db);
    res.json(db.dicomConfig);
  });

  app.post("/api/admin/integrations/dicom/studies", (req, res) => {
    if (req.authUser?.role !== "admin") return res.status(403).json({ message: "Hospital operations access is required." });
    const studyInstanceUid = String(req.body.studyInstanceUid || "").trim();
    const patientId = String(req.body.patientId || "").trim();
    if (!studyInstanceUid || !patientId) return res.status(400).json({ message: "Study Instance UID and CareBridge patient are required." });
    const db = readDb();
    ensureState(db);
    if (!(db.users || []).some((user) => user.id === patientId && user.role === "patient")) return res.status(404).json({ message: "Patient not found." });
    const existing = db.dicomStudies.find((row) => row.studyInstanceUid === studyInstanceUid);
    if (existing) return res.json(existing);
    const row = {
      id: nid("dcm"), patientId, studyInstanceUid,
      accessionNumber: String(req.body.accessionNumber || "").trim(),
      modality: String(req.body.modality || "").trim(),
      description: String(req.body.description || "").trim(),
      studyDate: String(req.body.studyDate || "").trim(),
      seriesCount: Number(req.body.seriesCount || 0),
      instances: Number(req.body.instances || 0),
      registeredAt: new Date().toISOString(),
      registeredBy: req.authUser.id,
    };
    db.dicomStudies.push(row);
    writeDb(db);
    res.status(201).json(row);
  });
}
