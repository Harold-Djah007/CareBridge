const WORKFLOWS = {
  patient: ["registered", "active", "archived"],
  encounter: ["scheduled", "confirmed", "in_consult", "completed"],
  admission: ["requested", "accepted", "admitted", "discharged"],
  billing: ["due", "pending", "paid"],
  support: ["open", "in_progress", "resolved"],
};

const TYPES = [
  { id: "patient", label: "Patient file" },
  { id: "encounter", label: "Encounter" },
  { id: "admission", label: "Admission" },
  { id: "billing", label: "Billing" },
  { id: "support", label: "Support" },
];

const closedStages = new Set(["archived", "completed", "discharged", "paid", "resolved", "cancelled", "declined"]);

function nameOf(db, id) {
  return (db.users.find((u) => u.id === id) || {}).name || "";
}

function upsert(db, row) {
  db.cases = db.cases || [];
  const found = db.cases.find((c) => c.id === row.id);
  if (!found) {
    db.cases.push({
      events: [{
        id: `ev-${row.id}-reg`,
        form: "registration",
        at: row.openedAt,
        actorName: "System",
        detail: "Case opened from hospital record",
        properties: row.properties,
      }],
      ...row,
    });
    return true;
  }
  found.caseName = row.caseName;
  found.caseType = row.caseType;
  found.parentId = row.parentId || found.parentId || "";
  found.externalId = row.externalId;
  found.ownerId = row.ownerId;
  found.ownerName = row.ownerName;
  found.stage = row.stage;
  found.status = row.status;
  found.openedAt = found.openedAt || row.openedAt;
  found.lastModified = row.lastModified;
  found.properties = { ...(found.properties || {}), ...row.properties };
  found.link = row.link;
  return false;
}

function encounterStage(status) {
  if (status === "completed") return "completed";
  if (status === "confirmed") return "confirmed";
  if (status === "cancelled" || status === "declined") return "completed";
  return "scheduled";
}

function admissionStage(status) {
  if (status === "pending") return "requested";
  if (status === "confirmed" || status === "accepted") return "accepted";
  if (status === "admitted") return "admitted";
  if (status === "completed" || status === "discharged") return "discharged";
  if (status === "declined") return "discharged";
  return "requested";
}

function billingStage(status, method) {
  if (status === "paid") return "paid";
  if (method) return "pending";
  return "due";
}

export function syncCases(db) {
  db.cases = db.cases || [];
  let added = 0;
  const now = new Date().toISOString();

  (db.users || []).filter((u) => u.role === "patient").forEach((p) => {
    if (upsert(db, {
      id: `case-patient-${p.id}`,
      caseType: "patient",
      caseName: p.name,
      externalId: p.mrn || p.id,
      parentId: "",
      ownerId: p.id,
      ownerName: p.name,
      stage: p.status === "inactive" ? "archived" : "active",
      status: p.status === "inactive" ? "closed" : "open",
      openedAt: p.openedAt || now,
      lastModified: now,
      link: `/records/${p.id}`,
      properties: {
        mrn: p.mrn || "",
        email: p.email || "",
        phone: p.phone || "",
        city: p.city || "",
        insurance: p.insurance || "",
        allergies: p.allergies || "",
        blood_type: p.bloodType || "",
        emergency_contact: p.emergencyContact || "",
      },
    })) added += 1;
  });

  (db.appointments || []).forEach((a) => {
    const patient = db.users.find((u) => u.id === a.patientId) || {};
    const doctor = db.users.find((u) => u.id === a.doctorId) || {};
    const stage = encounterStage(a.status);
    if (upsert(db, {
      id: `case-encounter-${a.id}`,
      caseType: "encounter",
      caseName: `${patient.name || "Patient"} · ${a.reason || "Visit"}`,
      externalId: a.id,
      parentId: `case-patient-${a.patientId}`,
      ownerId: a.doctorId,
      ownerName: doctor.name || "",
      stage,
      status: closedStages.has(stage) ? "closed" : "open",
      openedAt: `${a.date || now.slice(0, 10)}T${a.time || "00:00"}:00.000Z`,
      lastModified: now,
      link: "/admin/appointments",
      properties: {
        patient: patient.name || "",
        mrn: patient.mrn || "",
        clinician: doctor.name || "",
        date: a.date || "",
        time: a.time || "",
        mode: a.mode || "",
        reason: a.reason || "",
        appointment_status: a.status || "",
      },
    })) added += 1;
  });

  (db.wardBookings || []).forEach((w) => {
    const patient = db.users.find((u) => u.id === w.patientId) || {};
    const stage = admissionStage(w.status);
    if (upsert(db, {
      id: `case-admission-${w.id}`,
      caseType: "admission",
      caseName: `${patient.name || "Patient"} · ${w.ward}`,
      externalId: w.id,
      parentId: `case-patient-${w.patientId}`,
      ownerId: w.patientId,
      ownerName: patient.name || "",
      stage,
      status: closedStages.has(stage) ? "closed" : "open",
      openedAt: w.date ? `${w.date}T08:00:00.000Z` : now,
      lastModified: now,
      link: "/admin/hospital",
      properties: {
        patient: patient.name || "",
        mrn: patient.mrn || "",
        ward: w.ward || "",
        room: w.roomType || "",
        nights: String(w.nights || 1),
        arrival: w.date || "",
        notes: w.notes || "",
        booking_status: w.status || "",
      },
    })) added += 1;
  });

  (db.invoices || []).forEach((inv) => {
    const patient = db.users.find((u) => u.id === inv.patientId) || {};
    const stage = billingStage(inv.status, inv.method);
    if (upsert(db, {
      id: `case-billing-${inv.id}`,
      caseType: "billing",
      caseName: `${patient.name || "Patient"} · ${inv.item}`,
      externalId: inv.id,
      parentId: `case-patient-${inv.patientId}`,
      ownerId: inv.patientId,
      ownerName: patient.name || "",
      stage,
      status: stage === "paid" ? "closed" : "open",
      openedAt: inv.date ? `${inv.date}T08:00:00.000Z` : now,
      lastModified: inv.paidAt || now,
      link: `/pay?invoice=${inv.id}`,
      properties: {
        patient: patient.name || "",
        mrn: patient.mrn || "",
        item: inv.item || "",
        amount: `GHS ${inv.amount}`,
        currency: inv.currency || "GHS",
        invoice_status: inv.status || "",
        method: inv.method || "",
        receipt: inv.receiptNo || "",
      },
    })) added += 1;
  });

  (db.tickets || []).forEach((t) => {
    const owner = db.users.find((u) => u.id === t.userId) || {};
    const stage = t.status === "resolved" ? "resolved" : t.status === "in_progress" ? "in_progress" : "open";
    if (upsert(db, {
      id: `case-support-${t.id}`,
      caseType: "support",
      caseName: t.subject,
      externalId: t.id,
      parentId: owner.role === "patient" ? `case-patient-${t.userId}` : "",
      ownerId: t.userId,
      ownerName: owner.name || "",
      stage,
      status: stage === "resolved" ? "closed" : "open",
      openedAt: t.createdAt || now,
      lastModified: t.updatedAt || now,
      link: "/support",
      properties: {
        requester: owner.name || "",
        email: owner.email || "",
        category: t.category || "",
        ticket_status: t.status || "",
        message: t.body || "",
      },
    })) added += 1;
  });

  return added;
}

function enrich(db, row) {
  const children = (db.cases || []).filter((c) => c.parentId === row.id).map((c) => ({
    id: c.id,
    caseName: c.caseName,
    caseType: c.caseType,
    stage: c.stage,
    status: c.status,
  }));
  const parent = row.parentId ? (db.cases || []).find((c) => c.id === row.parentId) : null;
  return {
    ...row,
    workflow: WORKFLOWS[row.caseType] || [],
    typeLabel: (TYPES.find((t) => t.id === row.caseType) || {}).label || row.caseType,
    children,
    parent: parent ? { id: parent.id, caseName: parent.caseName, caseType: parent.caseType } : null,
    eventCount: (row.events || []).length,
  };
}

export function mountCases(app, { readDb, writeDb, safeUser }) {
  app.get("/api/cases/meta", (_, res) => {
    res.json({ types: TYPES, workflows: WORKFLOWS });
  });

  app.get("/api/cases", (req, res) => {
    const db = readDb();
    const added = syncCases(db);
    if (added) writeDb(db);
    let rows = db.cases || [];
    const { type, status, q, ownerId } = req.query;
    if (type && type !== "all") rows = rows.filter((c) => c.caseType === type);
    if (status && status !== "all") rows = rows.filter((c) => c.status === status);
    if (ownerId) rows = rows.filter((c) => c.ownerId === ownerId);
    if (q) {
      const needle = String(q).toLowerCase();
      rows = rows.filter((c) => `${c.caseName} ${c.externalId} ${c.ownerName} ${JSON.stringify(c.properties)}`.toLowerCase().includes(needle));
    }
    rows = rows.slice().sort((a, b) => String(b.lastModified).localeCompare(String(a.lastModified)));
    res.json(rows.map((c) => enrich(db, c)));
  });

  app.get("/api/cases/:id", (req, res) => {
    const db = readDb();
    syncCases(db);
    const row = (db.cases || []).find((c) => c.id === req.params.id);
    if (!row) return res.status(404).json({ message: "Case not found" });
    res.json(enrich(db, row));
  });

  app.post("/api/cases/:id/forms", (req, res) => {
    const db = readDb();
    const row = (db.cases || []).find((c) => c.id === req.params.id);
    if (!row) return res.status(404).json({ message: "Case not found" });
    const actor = db.users.find((u) => u.id === req.body.actorId) || {};
    const form = req.body.form === "close" ? "close" : "followup";
    const event = {
      id: `ev${Date.now()}`,
      form,
      at: new Date().toISOString(),
      actorId: actor.id || "",
      actorName: actor.name || "Operations",
      detail: String(req.body.detail || "").trim() || (form === "close" ? "Case closed" : "Follow-up recorded"),
      properties: req.body.properties || {},
    };
    row.events = row.events || [];
    row.events.push(event);
    if (req.body.stage && (WORKFLOWS[row.caseType] || []).includes(req.body.stage)) {
      row.stage = req.body.stage;
    }
    if (form === "close" || closedStages.has(row.stage)) {
      row.status = "closed";
      row.closedAt = event.at;
    } else {
      row.status = "open";
      row.closedAt = "";
    }
    if (req.body.properties && typeof req.body.properties === "object") {
      row.properties = { ...(row.properties || {}), ...req.body.properties };
    }
    row.lastModified = event.at;
    writeDb(db);
    res.status(201).json(enrich(db, row));
  });

  app.patch("/api/cases/:id", (req, res) => {
    const db = readDb();
    const row = (db.cases || []).find((c) => c.id === req.params.id);
    if (!row) return res.status(404).json({ message: "Case not found" });
    if (req.body.stage && (WORKFLOWS[row.caseType] || []).includes(req.body.stage)) row.stage = req.body.stage;
    if (req.body.status === "open" || req.body.status === "closed") row.status = req.body.status;
    if (req.body.ownerId) {
      row.ownerId = req.body.ownerId;
      row.ownerName = nameOf(db, req.body.ownerId) || row.ownerName;
    }
    if (req.body.properties && typeof req.body.properties === "object") {
      row.properties = { ...(row.properties || {}), ...req.body.properties };
    }
    row.lastModified = new Date().toISOString();
    if (row.status === "closed") row.closedAt = row.closedAt || row.lastModified;
    writeDb(db);
    res.json(enrich(db, { ...row, actor: safeUser(db.users.find((u) => u.id === req.body.actorId) || {}) }));
  });
}
