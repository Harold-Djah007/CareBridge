const nid = (p) => `${p}${Date.now()}${Math.floor(Math.random() * 900)}`;

const SEED = {
  conditions: [
    { id: "c1", patientId: "p1", name: "Essential hypertension", since: "2023-04-11", status: "active", clinician: "Dr. Efua Boateng" },
    { id: "c2", patientId: "p1", name: "Tension-type headache", since: "2025-11-02", status: "monitoring", clinician: "Dr. Kwame Owusu" },
    { id: "c3", patientId: "p2", name: "Post-operative recovery · tibial ORIF", since: "2026-08-14", status: "active", clinician: "Dr. Kwame Owusu" },
  ],
  medications: [
    { id: "med1", patientId: "p1", name: "Amlodipine 5 mg", sig: "One tablet every morning", status: "active", started: "2024-01-18", prescriber: "Dr. Efua Boateng" },
    { id: "med2", patientId: "p1", name: "Paracetamol 500 mg", sig: "One to two tablets as needed for headache, max 4 g/day", status: "active", started: "2026-08-20", prescriber: "Dr. Kwame Owusu" },
    { id: "med3", patientId: "p2", name: "Ibuprofen 400 mg", sig: "One tablet every 8 hours with food for 5 days", status: "active", started: "2026-08-15", prescriber: "Dr. Kwame Owusu" },
  ],
  vitals: [
    { id: "v1", patientId: "p1", takenAt: "2026-08-20T09:20:00.000Z", bp: "138/86", hr: 76, temp: 36.6, spo2: 98, weight: 68, bmi: 24.1, recordedBy: "OPD nurse" },
    { id: "v2", patientId: "p1", takenAt: "2026-09-05T10:25:00.000Z", bp: "132/82", hr: 72, temp: 36.5, spo2: 99, weight: 67.5, bmi: 23.9, recordedBy: "Dr. Kwame Owusu" },
    { id: "v3", patientId: "p2", takenAt: "2026-09-01T11:00:00.000Z", bp: "118/74", hr: 80, temp: 36.8, spo2: 97, weight: 81, bmi: 26.4, recordedBy: "Ward 2" },
  ],
  labs: [
    { id: "lab1", patientId: "p1", name: "Full blood count", date: "2026-08-18", status: "final", result: "Hb 13.2 g/dL · WBC 6.1 · Plt 248", flag: "normal", orderedBy: "Dr. Kwame Owusu" },
    { id: "lab2", patientId: "p1", name: "Lipid panel", date: "2026-08-18", status: "final", result: "LDL 3.4 mmol/L · HDL 1.2 · TG 1.6", flag: "review", orderedBy: "Dr. Efua Boateng" },
    { id: "lab3", patientId: "p1", name: "Urea & electrolytes", date: "2026-09-04", status: "final", result: "Na 139 · K 4.1 · Creat 78 µmol/L", flag: "normal", orderedBy: "Dr. Efua Boateng" },
  ],
  notes: [
    {
      id: "note1",
      patientId: "p1",
      appointmentId: "apt3",
      authorId: "d1",
      author: "Dr. Kwame Owusu",
      date: "2026-08-20",
      type: "SOAP",
      subjective: "Annual review. Occasional headaches, worse with long screen time. Sleeps 6 hours.",
      objective: "BP 138/86. Neuro exam non-focal. BMI 24.1.",
      assessment: "Likely tension headache. Borderline BP — continue home log.",
      plan: "Paracetamol PRN. Return if focal symptoms. Cardiology review for BP.",
    },
    {
      id: "note2",
      patientId: "p1",
      appointmentId: "apt1",
      authorId: "d1",
      author: "Dr. Kwame Owusu",
      date: "2026-09-05",
      type: "SOAP",
      subjective: "Headaches reduced. Fatigue improving after iron-rich meals as advised.",
      objective: "BP 132/82, HR 72, SpO2 99%. Alert, well.",
      assessment: "Improving. Hypertension still active on amlodipine.",
      plan: "Continue current meds. Cardiology video on 12 Sep. Safety-net for sudden severe headache.",
    },
  ],
  prescriptions: [
    { id: "rx1", patientId: "p1", doctorId: "d2", drug: "Amlodipine 5 mg tablets", sig: "One every morning", qty: "30 tablets", refills: 2, status: "active", date: "2026-08-12", pharmacy: "Ridge Campus pharmacy" },
    { id: "rx2", patientId: "p1", doctorId: "d1", drug: "Paracetamol 500 mg tablets", sig: "1–2 tablets up to 4 times daily", qty: "20 tablets", refills: 0, status: "active", date: "2026-08-20", pharmacy: "Ridge Campus pharmacy" },
    { id: "rx3", patientId: "p2", doctorId: "d1", drug: "Ibuprofen 400 mg tablets", sig: "One every 8 hours with food × 5 days", qty: "15 tablets", refills: 0, status: "active", date: "2026-08-15", pharmacy: "Ridge Campus pharmacy" },
  ],
  invoices: [
    { id: "inv1", patientId: "p1", date: "2026-08-20", item: "Outpatient consultation · General medicine", amount: 350, currency: "GHS", status: "paid", method: "NHIS + top-up" },
    { id: "inv2", patientId: "p1", date: "2026-08-18", item: "Laboratory panel (FBC, lipids, U&E)", amount: 220, currency: "GHS", status: "paid", method: "Card" },
    { id: "inv3", patientId: "p1", date: "2026-09-08", item: "General Ward · private room × 2 nights", amount: 1800, currency: "GHS", status: "due", method: "NHIS pending" },
    { id: "inv4", patientId: "p2", date: "2026-08-14", item: "Orthopaedic follow-up", amount: 400, currency: "GHS", status: "paid", method: "Cash" },
  ],
  intakes: [
    {
      id: "in1",
      patientId: "p1",
      appointmentId: "apt2",
      submittedAt: "2026-09-10T08:00:00.000Z",
      symptoms: "No chest pain today. Mild headache after work.",
      pain: 2,
      medsTaken: "Amlodipine this morning",
      redFlags: false,
    },
  ],
  consents: [
    { id: "cs1", patientId: "p1", type: "telehealth", signedAt: "2026-08-01T10:00:00.000Z", version: "2026.1" },
    { id: "cs2", patientId: "p2", type: "telehealth", signedAt: "2026-08-14T10:00:00.000Z", version: "2026.1" },
  ],
  audit: [
    { id: "au1", at: "2026-09-03T12:00:00.000Z", actorId: "adm1", action: "login", entity: "system", entityId: "", detail: "Operations console opened" },
    { id: "au2", at: "2026-09-05T10:40:00.000Z", actorId: "d1", action: "note.create", entity: "note", entityId: "note2", detail: "SOAP note for Ama Mensah" },
  ],
};

export function ensureClinical(db) {
  ["medications", "conditions", "vitals", "labs", "notes", "prescriptions", "invoices", "intakes", "consents", "audit", "tickets"].forEach((k) => {
    if (!Array.isArray(db[k])) db[k] = [];
  });
  if (!db.medications.length) {
    Object.entries(SEED).forEach(([k, rows]) => {
      db[k] = rows;
    });
  }
  return db;
}

export function audit(db, { actorId, action, entity, entityId, detail }) {
  db.audit = db.audit || [];
  db.audit.unshift({
    id: nid("au"),
    at: new Date().toISOString(),
    actorId: actorId || "",
    action,
    entity,
    entityId: entityId || "",
    detail: detail || "",
  });
}

const chartFor = (db, patientId) => {
  const patient = db.users.find((u) => u.id === patientId);
  if (!patient || patient.role !== "patient") return null;
  const { password, ...safe } = patient;
  return {
    patient: safe,
    conditions: db.conditions.filter((r) => r.patientId === patientId),
    medications: db.medications.filter((r) => r.patientId === patientId),
    vitals: db.vitals.filter((r) => r.patientId === patientId).sort((a, b) => String(b.takenAt).localeCompare(a.takenAt)),
    labs: db.labs.filter((r) => r.patientId === patientId),
    notes: db.notes.filter((r) => r.patientId === patientId),
    prescriptions: db.prescriptions.filter((r) => r.patientId === patientId),
    invoices: db.invoices.filter((r) => r.patientId === patientId),
    intakes: db.intakes.filter((r) => r.patientId === patientId),
    consents: db.consents.filter((r) => r.patientId === patientId),
    appointments: db.appointments.filter((a) => a.patientId === patientId),
    wards: db.wardBookings.filter((w) => w.patientId === patientId),
  };
};

export function mountClinical(app, ctx) {
  const { readDb, writeDb, safeUser, notify, emailPatient } = ctx;

  const requireRole = (req, res, roles, message) => {
    if (req.authUser && roles.includes(req.authUser.role)) return true;
    res.status(403).json({ message });
    return false;
  };
  const patientExists = (db, patientId) => (db.users || []).some((user) => user.id === patientId && user.role === "patient" && user.status !== "inactive");

  app.get("/api/chart/:patientId", (req, res) => {
    if (!requireRole(req, res, ["patient", "doctor", "admin"], "Clinical records are available to the patient, clinicians, and authorized hospital operations.")) return;
    if (req.authUser.role === "patient" && req.params.patientId !== req.authUser.id) return res.status(403).json({ message: "You can only open your own clinical file." });
    const db = readDb();
    const chart = chartFor(db, req.params.patientId);
    if (!chart) return res.status(404).json({ message: "No clinical file for that person." });
    res.json(chart);
  });

  app.post("/api/notes", (req, res) => {
    if (!requireRole(req, res, ["doctor", "admin"], "Only clinicians or authorized hospital operations can add clinical notes.")) return;
    const db = readDb();
    const patientId = String(req.body.patientId || "").trim();
    if (!patientExists(db, patientId)) return res.status(404).json({ message: "Patient account not found." });
    const note = {
      id: nid("note"),
      patientId,
      appointmentId: req.body.appointmentId || "",
      authorId: req.authUser.id,
      author: req.authUser.name || "Clinician",
      date: new Date().toISOString().slice(0, 10),
      type: "SOAP",
      subjective: req.body.subjective || "",
      objective: req.body.objective || "",
      assessment: req.body.assessment || "",
      plan: req.body.plan || "",
    };
    db.notes.push(note);
    audit(db, { actorId: note.authorId, action: "note.create", entity: "note", entityId: note.id, detail: `SOAP for ${note.patientId}` });
    writeDb(db);
    res.status(201).json(note);
  });

  app.post("/api/vitals", (req, res) => {
    if (!requireRole(req, res, ["doctor", "admin"], "Only clinicians or authorized hospital operations can record vitals.")) return;
    const db = readDb();
    const patientId = String(req.body.patientId || "").trim();
    if (!patientExists(db, patientId)) return res.status(404).json({ message: "Patient account not found." });
    const row = {
      id: nid("v"),
      patientId,
      takenAt: new Date().toISOString(),
      bp: req.body.bp || "",
      hr: Number(req.body.hr || 0),
      temp: Number(req.body.temp || 0),
      spo2: Number(req.body.spo2 || 0),
      weight: Number(req.body.weight || 0),
      bmi: Number(req.body.bmi || 0),
      recordedBy: req.authUser.name || "Clinic",
    };
    db.vitals.push(row);
    audit(db, { actorId: req.authUser.id, action: "vitals.create", entity: "vitals", entityId: row.id, detail: `HR ${row.hr} BP ${row.bp}` });
    writeDb(db);
    res.status(201).json(row);
  });

  const enrichRx = (db, rx) => {
    const items = Array.isArray(rx.items) && rx.items.length
      ? rx.items
      : [{ stockId: "", drug: rx.drug, sig: rx.sig || "", qty: rx.qty || "" }];
    return {
      ...rx,
      items,
      doctor: safeUser(db.users.find((u) => u.id === rx.doctorId) || {}),
      patient: safeUser(db.users.find((u) => u.id === rx.patientId) || {}),
    };
  };

  app.get("/api/prescriptions", (req, res) => {
    if (!requireRole(req, res, ["patient", "doctor", "admin"], "Prescription records are available to patients, prescribers, and authorized hospital operations.")) return;
    const db = readDb();
    let rows = db.prescriptions || [];
    if (req.authUser.role === "patient") rows = rows.filter((row) => row.patientId === req.authUser.id);
    if (req.authUser.role === "doctor") rows = rows.filter((row) => row.doctorId === req.authUser.id);
    if (req.authUser.role === "admin" && req.query.patientId) rows = rows.filter((row) => row.patientId === req.query.patientId);
    res.json(rows.slice().reverse().map((row) => enrichRx(db, row)));
  });

  app.get("/api/prescriptions/:id", (req, res) => {
    if (!requireRole(req, res, ["patient", "doctor", "admin"], "Prescription records are available to patients, prescribers, and authorized hospital operations.")) return;
    const db = readDb();
    const rx = (db.prescriptions || []).find((row) => row.id === req.params.id);
    if (!rx) return res.status(404).json({ message: "Prescription not found" });
    if (req.authUser.role === "patient" && rx.patientId !== req.authUser.id) return res.status(403).json({ message: "That prescription is not on your patient file." });
    res.json(enrichRx(db, rx));
  });

  app.post("/api/prescriptions", async (req, res) => {
    if (!requireRole(req, res, ["doctor"], "Only a signed-in prescribing clinician can issue a prescription.")) return;
    const db = readDb();
    const patientId = String(req.body.patientId || "").trim();
    if (!patientExists(db, patientId)) return res.status(404).json({ message: "Patient account not found." });
    const items = Array.isArray(req.body.items) && req.body.items.length
      ? req.body.items.map((row) => ({
          stockId: row.stockId || row.id || "",
          drug: String(row.drug || row.name || "").trim(),
          sig: String(row.sig || "").trim(),
          qty: String(row.qty || "").trim() || "1",
        })).filter((row) => row.drug)
      : req.body.drug
        ? [{ stockId: req.body.stockId || "", drug: String(req.body.drug).trim(), sig: String(req.body.sig || "").trim(), qty: String(req.body.qty || "").trim() }]
        : [];
    if (!items.length) return res.status(400).json({ message: "Add at least one medicine." });
    const rx = {
      id: nid("rx"),
      patientId,
      doctorId: req.authUser.id,
      drug: items.map((i) => i.drug).join(", "),
      sig: items.map((i) => i.sig).filter(Boolean).join("; "),
      qty: items.map((i) => i.qty).filter(Boolean).join(", "),
      items,
      notes: String(req.body.notes || "").trim(),
      source: req.body.source || "chart",
      refills: Number(req.body.refills || 0),
      status: "active",
      date: new Date().toISOString().slice(0, 10),
      issuedAt: new Date().toISOString(),
      pharmacy: "Ridge Campus pharmacy",
    };
    db.prescriptions.push(rx);
    items.forEach((line) => {
      db.medications.push({
        id: nid("med"),
        patientId: rx.patientId,
        name: line.drug,
        sig: line.sig,
        status: "active",
        started: rx.date,
        prescriber: (db.users.find((u) => u.id === rx.doctorId) || {}).name,
      });
    });
    const doctor = db.users.find((u) => u.id === rx.doctorId) || {};
    audit(db, { actorId: rx.doctorId, action: "rx.create", entity: "prescription", entityId: rx.id, detail: rx.drug });
    notify(db, rx.patientId, "New prescription", `${doctor.name || "Your doctor"} issued a prescription. Print it or buy from Pharmacy.`);
    await emailPatient(db, rx.patientId, {
      type: "account",
      subject: "A prescription was added to your file",
      heading: "New prescription",
      intro: `${doctor.name || "Your clinician"} issued a prescription after your consult. Open Prescriptions to print or save it, or buy the medicines on CareBridge / collect at Ridge pharmacy.`,
      details: items.map((i) => [i.drug, `${i.sig || "As directed"} · ${i.qty}`]),
    });
    writeDb(db);
    res.status(201).json(enrichRx(db, rx));
  });

  app.patch("/api/prescriptions/:id", async (req, res) => {
    if (!requireRole(req, res, ["patient", "doctor", "admin"], "You do not have permission to update this prescription.")) return;
    const db = readDb();
    const rx = db.prescriptions.find((row) => row.id === req.params.id);
    if (!rx) return res.status(404).json({ message: "Prescription not found" });

    if (req.authUser.role === "patient") {
      if (rx.patientId !== req.authUser.id) return res.status(403).json({ message: "That prescription is not on your patient file." });
      const allowed = new Set(["refillRequested", "actorId"]);
      if (Object.keys(req.body || {}).some((key) => !allowed.has(key)) || req.body.refillRequested !== true) {
        return res.status(403).json({ message: "Patients can request a refill but cannot alter a clinical prescription." });
      }
      rx.refillRequested = true;
      rx.refillRequestedAt = new Date().toISOString();
      db.users.filter((user) => user.role === "doctor" || user.role === "admin").forEach((user) => {
        notify(db, user.id, "Refill requested", `${rx.drug} refill requested.`);
      });
      notify(db, rx.patientId, "Refill requested", `Pharmacy will review ${rx.drug}.`);
    } else {
      if (req.authUser.role === "doctor" && rx.doctorId !== req.authUser.id) {
        return res.status(403).json({ message: "Prescribers can only amend prescriptions they issued." });
      }
      if (req.body.status !== undefined) {
        const status = String(req.body.status).trim().toLowerCase();
        if (!["active", "completed", "cancelled", "stopped"].includes(status)) return res.status(400).json({ message: "Invalid prescription status." });
        rx.status = status;
      }
      if (req.body.notes !== undefined) rx.notes = String(req.body.notes || "").trim();
      if (req.body.refills !== undefined) rx.refills = Math.max(0, Number(req.body.refills || 0));
      if (req.body.refillRequested !== undefined) rx.refillRequested = Boolean(req.body.refillRequested);
      rx.updatedAt = new Date().toISOString();
    }

    audit(db, { actorId: req.authUser.id, action: "rx.update", entity: "prescription", entityId: rx.id, detail: req.authUser.role === "patient" ? "refill requested" : JSON.stringify({ status: rx.status, refills: rx.refills }) });
    writeDb(db);
    res.json(enrichRx(db, rx));
  });

  app.post("/api/intakes", (req, res) => {
    if (!requireRole(req, res, ["patient"], "Pre-visit intake is submitted by the signed-in patient.")) return;
    const db = readDb();
    const row = {
      id: nid("in"),
      patientId: req.authUser.id,
      appointmentId: req.body.appointmentId || "",
      submittedAt: new Date().toISOString(),
      symptoms: req.body.symptoms || "",
      pain: Number(req.body.pain || 0),
      medsTaken: req.body.medsTaken || "",
      redFlags: Boolean(req.body.redFlags),
    };
    db.intakes.push(row);
    audit(db, { actorId: row.patientId, action: "intake.create", entity: "intake", entityId: row.id, detail: `pain ${row.pain}` });
    db.users.filter((u) => u.role === "doctor").forEach((u) => {
      notify(db, u.id, "Pre-visit intake in", "A patient completed the visit questionnaire.");
    });
    writeDb(db);
    res.status(201).json(row);
  });

  app.post("/api/consents", (req, res) => {
    if (!requireRole(req, res, ["patient"], "Consent must be signed by the authenticated patient.")) return;
    const db = readDb();
    const row = {
      id: nid("cs"),
      patientId: req.authUser.id,
      type: req.body.type || "telehealth",
      signedAt: new Date().toISOString(),
      version: "2026.1",
    };
    db.consents.push(row);
    audit(db, { actorId: row.patientId, action: "consent.sign", entity: "consent", entityId: row.id, detail: row.type });
    writeDb(db);
    res.status(201).json(row);
  });

  app.get("/api/billing", (req, res) => {
    if (!requireRole(req, res, ["patient", "admin"], "Billing records are available to the patient and authorized hospital operations.")) return;
    const db = readDb();
    let rows = db.invoices || [];
    if (req.authUser.role === "patient") rows = rows.filter((invoice) => invoice.patientId === req.authUser.id);
    if (req.authUser.role === "admin" && req.query.patientId) rows = rows.filter((invoice) => invoice.patientId === req.query.patientId);
    res.json(rows.map((invoice) => ({ ...invoice, patient: safeUser(db.users.find((user) => user.id === invoice.patientId) || {}) })));
  });

  app.patch("/api/billing/:id/pay", (_req, res) => {
    return res.status(410).json({ message: "Direct invoice payment is disabled. Use Shop & pay so online payments are verified before a receipt is issued." });
  });

  app.get("/api/admin/audit", (_, res) => {
    const db = readDb();
    res.json((db.audit || []).slice(0, 80).map((row) => ({
      ...row,
      actor: safeUser(db.users.find((u) => u.id === row.actorId) || { name: "System" }),
    })));
  });

  app.get("/api/admin/reports", (_, res) => {
    const db = readDb();
    const due = (db.invoices || []).filter((i) => i.status === "due");
    res.json({
      revenuePaid: (db.invoices || []).filter((i) => i.status === "paid").reduce((s, i) => s + Number(i.amount || 0), 0),
      revenueDue: due.reduce((s, i) => s + Number(i.amount || 0), 0),
      openRx: (db.prescriptions || []).filter((r) => r.status === "active").length,
      notesThisMonth: (db.notes || []).length,
      intakes: (db.intakes || []).length,
      consents: (db.consents || []).length,
      videoVisits: db.appointments.filter((a) => a.mode === "video").length,
      campusVisits: db.appointments.filter((a) => a.mode !== "video").length,
      completedVisits: db.appointments.filter((a) => a.status === "completed").length,
      allergies: db.users.filter((u) => u.role === "patient" && u.allergies && u.allergies !== "None recorded").length,
    });
  });
}
