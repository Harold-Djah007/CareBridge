import { smartScopeAllows } from "./smart.js";

const FHIR_VERSION = "4.0.1";

const refId = (value = "") => String(value).split("/").pop();
const isoDate = (value) => value ? new Date(value).toISOString() : undefined;
const clean = (value) => Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== null && item !== ""));

function bundle(req, resourceType, rows) {
  const base = `${req.protocol}://${req.get("host")}/api/fhir/R4`.replace(/\/$/, "");
  return {
    resourceType: "Bundle",
    type: "searchset",
    total: rows.length,
    link: [{ relation: "self", url: `${base}${req.path.replace(/^\/api\/fhir\/R4/, "")}` }],
    entry: rows.map((resource) => ({ fullUrl: `${base}/${resourceType}/${resource.id}`, resource })),
  };
}

function patientResource(user = {}) {
  return clean({
    resourceType: "Patient",
    id: user.id,
    identifier: user.mrn ? [{ system: "https://carebridge.health/mrn", value: user.mrn }] : undefined,
    active: user.status !== "inactive",
    name: [{ text: user.name, use: "official" }],
    telecom: [
      user.phone ? { system: "phone", value: user.phone, use: "mobile" } : null,
      user.email ? { system: "email", value: user.email } : null,
    ].filter(Boolean),
    address: user.city ? [{ city: user.city, country: "GH" }] : undefined,
    birthDate: user.dob || undefined,
    extension: [
      user.bloodType ? { url: "https://carebridge.health/fhir/StructureDefinition/blood-type", valueString: user.bloodType } : null,
      user.insurance ? { url: "https://carebridge.health/fhir/StructureDefinition/insurance", valueString: user.insurance } : null,
      user.allergies ? { url: "https://carebridge.health/fhir/StructureDefinition/allergies-summary", valueString: user.allergies } : null,
    ].filter(Boolean),
  });
}

function practitionerResource(user = {}) {
  return clean({
    resourceType: "Practitioner",
    id: user.id,
    active: user.status !== "inactive",
    name: [{ text: user.name, use: "official" }],
    telecom: [
      user.phone ? { system: "phone", value: user.phone } : null,
      user.email ? { system: "email", value: user.email } : null,
    ].filter(Boolean),
    qualification: user.specialty ? [{ code: { text: user.specialty } }] : undefined,
  });
}

function appointmentResource(row = {}) {
  const statusMap = { confirmed: "booked", pending: "proposed", completed: "fulfilled", cancelled: "cancelled", declined: "cancelled" };
  const start = row.date ? `${row.date}T${row.time || "00:00"}:00` : undefined;
  return clean({
    resourceType: "Appointment",
    id: row.id,
    status: statusMap[row.status] || "booked",
    serviceType: [{ text: row.mode === "video" ? "Teleconsultation" : "In-person consultation" }],
    description: row.reason || "Consultation",
    start: start ? isoDate(start) : undefined,
    participant: [
      { actor: { reference: `Patient/${row.patientId}` }, status: "accepted" },
      { actor: { reference: `Practitioner/${row.doctorId}` }, status: "accepted" },
    ],
  });
}

function conditionResource(row = {}) {
  const clinical = row.status === "active" ? "active" : row.status === "resolved" ? "resolved" : "inactive";
  return clean({
    resourceType: "Condition",
    id: row.id,
    clinicalStatus: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-clinical", code: clinical }] },
    code: { coding: row.code ? [{ system: row.codeSystem || "http://snomed.info/sct", code: row.code }] : undefined, text: row.name },
    subject: { reference: `Patient/${row.patientId}` },
    onsetDateTime: row.since ? isoDate(`${row.since}T00:00:00`) : undefined,
    recorder: row.clinician ? { display: row.clinician } : undefined,
  });
}

function medicationRequestResource(row = {}) {
  const status = ["active", "completed", "cancelled", "stopped", "draft"].includes(row.status) ? row.status : "active";
  const items = Array.isArray(row.items) && row.items.length ? row.items : [{ drug: row.drug, sig: row.sig, qty: row.qty }];
  return clean({
    resourceType: "MedicationRequest",
    id: row.id,
    status,
    intent: "order",
    medicationCodeableConcept: { text: items.map((item) => item.drug).filter(Boolean).join(" + ") || "Medication" },
    subject: { reference: `Patient/${row.patientId}` },
    requester: row.doctorId ? { reference: `Practitioner/${row.doctorId}` } : undefined,
    authoredOn: row.date ? isoDate(`${row.date}T00:00:00`) : undefined,
    dosageInstruction: items.map((item) => ({ text: item.sig || "As directed" })),
    dispenseRequest: { quantity: { value: items.reduce((sum, item) => sum + (Number.parseFloat(item.qty) || 0), 0) || undefined, unit: "unit" } },
  });
}

function vitalObservation(row = {}) {
  const components = [];
  if (row.bp) {
    const [systolic, diastolic] = String(row.bp).split("/").map(Number);
    if (systolic) components.push({ code: { coding: [{ system: "http://loinc.org", code: "8480-6", display: "Systolic blood pressure" }] }, valueQuantity: { value: systolic, unit: "mmHg", system: "http://unitsofmeasure.org", code: "mm[Hg]" } });
    if (diastolic) components.push({ code: { coding: [{ system: "http://loinc.org", code: "8462-4", display: "Diastolic blood pressure" }] }, valueQuantity: { value: diastolic, unit: "mmHg", system: "http://unitsofmeasure.org", code: "mm[Hg]" } });
  }
  if (row.hr) components.push({ code: { coding: [{ system: "http://loinc.org", code: "8867-4", display: "Heart rate" }] }, valueQuantity: { value: Number(row.hr), unit: "/min", system: "http://unitsofmeasure.org", code: "/min" } });
  if (row.temp) components.push({ code: { coding: [{ system: "http://loinc.org", code: "8310-5", display: "Body temperature" }] }, valueQuantity: { value: Number(row.temp), unit: "Cel", system: "http://unitsofmeasure.org", code: "Cel" } });
  if (row.spo2) components.push({ code: { coding: [{ system: "http://loinc.org", code: "59408-5", display: "Oxygen saturation" }] }, valueQuantity: { value: Number(row.spo2), unit: "%", system: "http://unitsofmeasure.org", code: "%" } });
  if (row.weight) components.push({ code: { coding: [{ system: "http://loinc.org", code: "29463-7", display: "Body weight" }] }, valueQuantity: { value: Number(row.weight), unit: "kg", system: "http://unitsofmeasure.org", code: "kg" } });
  return clean({
    resourceType: "Observation",
    id: row.id,
    status: "final",
    category: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/observation-category", code: "vital-signs" }] }],
    code: { coding: [{ system: "http://loinc.org", code: "85353-1", display: "Vital signs panel" }] },
    subject: { reference: `Patient/${row.patientId}` },
    effectiveDateTime: isoDate(row.takenAt),
    performer: row.recordedBy ? [{ display: row.recordedBy }] : undefined,
    component: components,
  });
}

function labObservation(row = {}) {
  return clean({
    resourceType: "Observation",
    id: row.id,
    status: row.status === "final" ? "final" : "preliminary",
    category: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/observation-category", code: "laboratory" }] }],
    code: clean({ coding: row.code ? [{ system: row.codeSystem || "http://loinc.org", code: row.code }] : undefined, text: row.name }),
    subject: { reference: `Patient/${row.patientId}` },
    effectiveDateTime: row.date ? isoDate(`${row.date}T00:00:00`) : undefined,
    valueString: row.result || undefined,
    interpretation: row.flag ? [{ text: row.flag }] : undefined,
    performer: row.orderedBy ? [{ display: row.orderedBy }] : undefined,
  });
}

function appointmentEncounter(row = {}) {
  const statusMap = { confirmed: "planned", pending: "planned", completed: "finished", cancelled: "cancelled", declined: "cancelled" };
  return clean({
    resourceType: "Encounter",
    id: `appt-${row.id}`,
    status: statusMap[row.status] || "planned",
    class: { system: "http://terminology.hl7.org/CodeSystem/v3-ActCode", code: row.mode === "video" ? "VR" : "AMB", display: row.mode === "video" ? "virtual" : "ambulatory" },
    subject: { reference: `Patient/${row.patientId}` },
    participant: row.doctorId ? [{ individual: { reference: `Practitioner/${row.doctorId}` } }] : undefined,
    period: row.date ? { start: isoDate(`${row.date}T${row.time || "00:00"}:00`) } : undefined,
    reasonCode: row.reason ? [{ text: row.reason }] : undefined,
  });
}

function wardEncounter(row = {}) {
  const statusMap = { pending: "planned", confirmed: "in-progress", discharged: "finished", completed: "finished", declined: "cancelled", cancelled: "cancelled" };
  return clean({
    resourceType: "Encounter",
    id: `ward-${row.id}`,
    status: statusMap[row.status] || "planned",
    class: { system: "http://terminology.hl7.org/CodeSystem/v3-ActCode", code: "IMP", display: "inpatient encounter" },
    subject: { reference: `Patient/${row.patientId}` },
    period: row.date ? { start: isoDate(`${row.date}T00:00:00`) } : undefined,
    location: row.ward ? [{ location: { display: row.ward } }] : undefined,
  });
}

function patientScope(req, requested) {
  if (req.authUser?.role === "patient") return req.authUser.id;
  return requested ? refId(requested) : "";
}

function operationOutcome(code, diagnostics) {
  return { resourceType: "OperationOutcome", issue: [{ severity: "error", code, diagnostics }] };
}

export function mountFhir(app, { readDb }) {
  const root = "/api/fhir/R4";

  app.get(`${root}/metadata`, (req, res) => res.type("application/fhir+json").json({
    resourceType: "CapabilityStatement",
    status: "active",
    date: new Date().toISOString(),
    kind: "instance",
    software: { name: "CareBridge FHIR Gateway", version: "1.1" },
    implementation: { description: "CareBridge FHIR R4 gateway with authenticated CareBridge sessions and SMART Backend Services scopes." },
    fhirVersion: FHIR_VERSION,
    format: ["json"],
    rest: [{
      mode: "server",
      security: {
        service: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/restful-security-service", code: "SMART-on-FHIR" }] }],
        description: "CareBridge session bearer tokens or scoped SMART Backend Services bearer tokens.",
        extension: [{ url: "http://fhir-registry.smarthealthit.org/StructureDefinition/oauth-uris", extension: [{ url: "token", valueUri: `${req.protocol}://${req.get("host")}/api/smart/token` }] }],
      },
      resource: ["Patient", "Practitioner", "Appointment", "Observation", "Condition", "MedicationRequest", "Encounter"].map((type) => ({ type, interaction: [{ code: "read" }, { code: "search-type" }] })),
    }],
  }));

  app.use(root, (req, res, next) => {
    const relative = req.path.replace(/^\/api\/fhir\/R4\/?/, "");
    if (!relative || relative === "metadata" || relative === ".well-known/smart-configuration") return next();
    if (req.authUser) return next();
    const resourceType = relative.split("/")[0];
    if (!req.smartAuth) return res.status(401).type("application/fhir+json").json(operationOutcome("login", "A CareBridge session or SMART access token is required."));
    if (!smartScopeAllows(req.smartAuth, resourceType, "read")) return res.status(403).type("application/fhir+json").json(operationOutcome("forbidden", `SMART token does not include system/${resourceType}.read.`));
    return next();
  });

  app.get(`${root}/Patient`, (req, res) => {
    const db = readDb();
    const patientId = patientScope(req, req.query._id || req.query.identifier);
    let rows = (db.users || []).filter((user) => user.role === "patient" && user.status !== "inactive");
    if (patientId) rows = rows.filter((user) => user.id === patientId || user.mrn === patientId);
    if (req.query.name) rows = rows.filter((user) => String(user.name).toLowerCase().includes(String(req.query.name).toLowerCase()));
    res.type("application/fhir+json").json(bundle(req, "Patient", rows.map(patientResource)));
  });

  app.get(`${root}/Patient/:id`, (req, res) => {
    if (req.authUser?.role === "patient" && req.params.id !== req.authUser.id) return res.status(403).type("application/fhir+json").json(operationOutcome("forbidden", "Patients can only read their own Patient resource."));
    const db = readDb();
    const user = (db.users || []).find((item) => item.id === req.params.id && item.role === "patient");
    if (!user) return res.status(404).type("application/fhir+json").json(operationOutcome("not-found", "Patient resource not found."));
    res.type("application/fhir+json").json(patientResource(user));
  });

  app.get(`${root}/Practitioner`, (req, res) => {
    const db = readDb();
    let rows = (db.users || []).filter((user) => ["doctor", "nurse"].includes(user.role) && user.status !== "inactive");
    if (req.query.name) rows = rows.filter((user) => String(user.name).toLowerCase().includes(String(req.query.name).toLowerCase()));
    res.type("application/fhir+json").json(bundle(req, "Practitioner", rows.map(practitionerResource)));
  });

  app.get(`${root}/Practitioner/:id`, (req, res) => {
    const db = readDb();
    const user = (db.users || []).find((item) => item.id === req.params.id && ["doctor", "nurse"].includes(item.role));
    if (!user) return res.status(404).type("application/fhir+json").json(operationOutcome("not-found", "Practitioner resource not found."));
    res.type("application/fhir+json").json(practitionerResource(user));
  });

  app.get(`${root}/Appointment`, (req, res) => {
    const db = readDb();
    const patientId = patientScope(req, req.query.patient);
    let rows = db.appointments || [];
    if (patientId) rows = rows.filter((row) => row.patientId === patientId);
    if (req.query.actor) {
      const actor = refId(req.query.actor);
      rows = rows.filter((row) => row.patientId === actor || row.doctorId === actor);
    }
    res.type("application/fhir+json").json(bundle(req, "Appointment", rows.map(appointmentResource)));
  });

  app.get(`${root}/Appointment/:id`, (req, res) => {
    const db = readDb();
    const row = (db.appointments || []).find((item) => item.id === req.params.id);
    if (!row) return res.status(404).type("application/fhir+json").json(operationOutcome("not-found", "Appointment resource not found."));
    if (req.authUser?.role === "patient" && row.patientId !== req.authUser.id) return res.status(403).type("application/fhir+json").json(operationOutcome("forbidden", "Patients can only read their own appointment resources."));
    res.type("application/fhir+json").json(appointmentResource(row));
  });

  app.get(`${root}/Condition`, (req, res) => {
    const db = readDb();
    const patientId = patientScope(req, req.query.patient || req.query.subject);
    let rows = db.conditions || [];
    if (patientId) rows = rows.filter((row) => row.patientId === patientId);
    res.type("application/fhir+json").json(bundle(req, "Condition", rows.map(conditionResource)));
  });

  app.get(`${root}/MedicationRequest`, (req, res) => {
    const db = readDb();
    const patientId = patientScope(req, req.query.patient || req.query.subject);
    let rows = db.prescriptions || [];
    if (patientId) rows = rows.filter((row) => row.patientId === patientId);
    res.type("application/fhir+json").json(bundle(req, "MedicationRequest", rows.map(medicationRequestResource)));
  });

  app.get(`${root}/Observation`, (req, res) => {
    const db = readDb();
    const patientId = patientScope(req, req.query.patient || req.query.subject);
    let vitals = db.vitals || [];
    let labs = db.labs || [];
    if (patientId) {
      vitals = vitals.filter((row) => row.patientId === patientId);
      labs = labs.filter((row) => row.patientId === patientId);
    }
    const category = String(req.query.category || "");
    const rows = category === "vital-signs" ? vitals.map(vitalObservation) : category === "laboratory" ? labs.map(labObservation) : [...vitals.map(vitalObservation), ...labs.map(labObservation)];
    res.type("application/fhir+json").json(bundle(req, "Observation", rows));
  });

  app.get(`${root}/Encounter`, (req, res) => {
    const db = readDb();
    const patientId = patientScope(req, req.query.patient || req.query.subject);
    let appointments = db.appointments || [];
    let wards = db.wardBookings || [];
    if (patientId) {
      appointments = appointments.filter((row) => row.patientId === patientId);
      wards = wards.filter((row) => row.patientId === patientId);
    }
    res.type("application/fhir+json").json(bundle(req, "Encounter", [...appointments.map(appointmentEncounter), ...wards.map(wardEncounter)]));
  });
}
