import fs from "fs";
import { spawn } from "child_process";
import { createRequire } from "module";

const clientRequire = createRequire(new URL("../client/package.json", import.meta.url));
const { io } = clientRequire("socket.io-client");

const dataFile = process.env.DATA_FILE;
const port = Number(process.env.PORT || 5055);
const base = `http://127.0.0.1:${port}`;
if (!dataFile) throw new Error("DATA_FILE is required");

const seed = JSON.parse(fs.readFileSync(dataFile, "utf8"));
const seeded = (role) => seed.users.find((u) => u.role === role && u.status !== "inactive");
const patientSeed = seeded("patient");
const doctorSeed = seeded("doctor");
const adminSeed = seeded("admin");
for (const [role, user] of [["patient", patientSeed], ["doctor", doctorSeed], ["admin", adminSeed]]) {
  if (!user?.email || !user?.password) throw new Error(`Missing seeded ${role} credentials`);
}

const server = spawn(process.execPath, ["index.js"], {
  cwd: new URL(".", import.meta.url),
  env: { ...process.env, DATA_FILE: dataFile, PORT: String(port) },
  stdio: ["ignore", "pipe", "pipe"],
});
let serverLog = "";
server.stdout.on("data", (chunk) => { serverLog += chunk; });
server.stderr.on("data", (chunk) => { serverLog += chunk; });

const stop = () => { if (!server.killed) server.kill("SIGTERM"); };
process.on("exit", stop);
process.on("SIGINT", () => { stop(); process.exit(130); });

async function waitForHealth() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (server.exitCode != null) throw new Error(`CareBridge server exited early\n${serverLog}`);
    try {
      const res = await fetch(`${base}/api/health`);
      if (res.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`CareBridge server did not become healthy\n${serverLog}`);
}

async function request(path, token, init = {}) {
  const headers = { ...(init.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (init.body && !headers["Content-Type"]) headers["Content-Type"] = "application/json";
  const res = await fetch(`${base}${path}`, { ...init, headers });
  const text = await res.text();
  let body;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!res.ok) throw new Error(`${init.method || "GET"} ${path} -> ${res.status}: ${text}`);
  return body;
}

async function login(user, role) {
  const result = await request("/api/login", "", {
    method: "POST",
    body: JSON.stringify({ email: user.email, password: user.password, expectedRole: role }),
  });
  if (!result?.token || result.user?.role !== role) throw new Error(`Invalid ${role} login response`);
  return result.token;
}

async function checkJson(label, path, token) {
  const body = await request(path, token);
  if (body === undefined) throw new Error(`${label} returned no JSON`);
  console.log(`✓ ${label}`);
}

async function socketCheck(role, token) {
  await new Promise((resolve, reject) => {
    const socket = io(base, { auth: { token }, transports: ["websocket"], timeout: 5000, reconnection: false });
    const timer = setTimeout(() => { socket.close(); reject(new Error(`${role} Socket.IO timeout`)); }, 7000);
    socket.on("connect", () => { clearTimeout(timer); socket.close(); console.log(`✓ ${role} realtime`); resolve(); });
    socket.on("connect_error", (error) => { clearTimeout(timer); socket.close(); reject(error); });
  });
}

async function wardCapacityCheck(patientToken, adminToken) {
  const before = await request("/api/wards", adminToken);
  const target = before.find((ward) => Number(ward.available || 0) > 0);
  if (!target) throw new Error("Ward capacity regression needs at least one available seeded bed");
  const start = Number(target.available);

  const booking = await request("/api/ward-bookings", patientToken, {
    method: "POST",
    body: JSON.stringify({
      patientId: patientSeed.id,
      ward: target.name,
      roomType: "Shared Room",
      date: "2099-12-20",
      nights: 1,
      notes: "CI live-capacity reservation",
    }),
  });
  if (!booking?.capacityHeld) throw new Error("New ward booking did not hold capacity");

  const afterHold = await request("/api/wards", adminToken);
  const heldWard = afterHold.find((ward) => ward.id === target.id);
  if (Number(heldWard?.available) !== start - 1) {
    throw new Error(`Ward hold arithmetic failed: expected ${start - 1}, got ${heldWard?.available}`);
  }

  const confirmed = await request(`/api/ward-bookings/${booking.id}`, adminToken, {
    method: "PATCH",
    body: JSON.stringify({ status: "confirmed" }),
  });
  if (confirmed.status !== "confirmed" || !confirmed.capacityHeld) throw new Error("Ward confirmation lost its held bed");

  const afterConfirm = await request("/api/wards", adminToken);
  const confirmedWard = afterConfirm.find((ward) => ward.id === target.id);
  if (Number(confirmedWard?.available) !== start - 1) {
    throw new Error(`Ward confirmation double-decremented capacity: expected ${start - 1}, got ${confirmedWard?.available}`);
  }

  const discharged = await request(`/api/ward-bookings/${booking.id}`, adminToken, {
    method: "PATCH",
    body: JSON.stringify({ status: "discharged" }),
  });
  if (discharged.status !== "discharged" || discharged.capacityHeld) throw new Error("Ward discharge did not release the held bed");

  const afterDischarge = await request("/api/wards", adminToken);
  const releasedWard = afterDischarge.find((ward) => ward.id === target.id);
  if (Number(releasedWard?.available) !== start) {
    throw new Error(`Ward release arithmetic failed: expected ${start}, got ${releasedWard?.available}`);
  }

  console.log(`✓ live ward arithmetic (${start} → ${start - 1} → ${start - 1} → ${start})`);
}

async function patientExperienceCheck(patientToken, adminToken) {
  const globalBefore = await request("/api/patient-experience", adminToken);
  const individualBefore = await request(`/api/admin/patient-experience/${patientSeed.id}`, adminToken);
  if (!globalBefore?.modules || !globalBefore?.home || !individualBefore?.effective) {
    throw new Error("Patient experience policy returned an invalid shape");
  }

  await request(`/api/admin/patient-experience/${patientSeed.id}`, adminToken, { method: "DELETE" });

  const globalChanged = await request("/api/admin/patient-experience", adminToken, {
    method: "PATCH",
    body: JSON.stringify({ modules: { support: false }, home: { quickActions: false } }),
  });
  if (globalChanged.modules?.support !== false || globalChanged.home?.quickActions !== false) {
    throw new Error("All-patient experience update was not persisted");
  }

  const inheritedView = await request("/api/patient-experience", patientToken);
  if (inheritedView.modules?.support !== false || inheritedView.home?.quickActions !== false || inheritedView.hasOverride) {
    throw new Error("Patient did not inherit the all-patient visibility policy");
  }

  const individual = await request(`/api/admin/patient-experience/${patientSeed.id}`, adminToken, {
    method: "PATCH",
    body: JSON.stringify({ modules: { support: true }, home: { quickActions: true } }),
  });
  if (!individual.hasOverride || individual.override?.modules?.support !== true || individual.override?.home?.quickActions !== true) {
    throw new Error("Individual patient override was not persisted");
  }
  if (individual.effective?.modules?.support !== true || individual.effective?.home?.quickActions !== true) {
    throw new Error("Individual patient override was not applied to the effective view");
  }

  const personalizedView = await request("/api/patient-experience", patientToken);
  if (personalizedView.modules?.support !== true || personalizedView.home?.quickActions !== true || !personalizedView.hasOverride) {
    throw new Error("Patient did not receive their individual visibility override");
  }

  const inheritedAgain = await request(`/api/admin/patient-experience/${patientSeed.id}`, adminToken, {
    method: "PATCH",
    body: JSON.stringify({ modules: { support: null } }),
  });
  if (inheritedAgain.override?.modules?.support !== undefined || inheritedAgain.effective?.modules?.support !== false) {
    throw new Error("Per-setting Default mode did not fall back to the all-patient policy");
  }
  if (inheritedAgain.effective?.home?.quickActions !== true) {
    throw new Error("Changing one individual override unexpectedly changed another override");
  }

  await request(`/api/admin/patient-experience/${patientSeed.id}`, adminToken, { method: "DELETE" });
  const resetView = await request("/api/patient-experience", patientToken);
  if (resetView.modules?.support !== false || resetView.home?.quickActions !== false || resetView.hasOverride) {
    throw new Error("Resetting the individual patient view did not restore all-patient defaults");
  }

  await request("/api/admin/patient-experience", adminToken, {
    method: "PATCH",
    body: JSON.stringify({ modules: globalBefore.modules, home: globalBefore.home }),
  });

  if (individualBefore.hasOverride) {
    await request(`/api/admin/patient-experience/${patientSeed.id}`, adminToken, {
      method: "PATCH",
      body: JSON.stringify({ modules: individualBefore.override.modules, home: individualBefore.override.home }),
    });
  }

  console.log("✓ dual-scope patient experience policy (all patients + individual override + inheritance)");
}

async function fhirCheck(patientToken, doctorToken) {
  const metadata = await request("/api/fhir/R4/metadata", patientToken);
  if (metadata?.resourceType !== "CapabilityStatement" || metadata?.fhirVersion !== "4.0.1") {
    throw new Error("FHIR R4 CapabilityStatement is invalid");
  }

  const patient = await request(`/api/fhir/R4/Patient/${patientSeed.id}`, patientToken);
  if (patient?.resourceType !== "Patient" || patient?.id !== patientSeed.id) throw new Error("FHIR Patient read failed");

  const resources = [
    ["Appointment", `/api/fhir/R4/Appointment?patient=Patient/${patientSeed.id}`],
    ["Observation", `/api/fhir/R4/Observation?patient=Patient/${patientSeed.id}`],
    ["Condition", `/api/fhir/R4/Condition?patient=Patient/${patientSeed.id}`],
    ["MedicationRequest", `/api/fhir/R4/MedicationRequest?patient=Patient/${patientSeed.id}`],
    ["Encounter", `/api/fhir/R4/Encounter?patient=Patient/${patientSeed.id}`],
  ];
  for (const [name, path] of resources) {
    const result = await request(path, patientToken);
    if (result?.resourceType !== "Bundle" || !Array.isArray(result.entry)) throw new Error(`FHIR ${name} search failed`);
  }

  const practitioners = await request("/api/fhir/R4/Practitioner", doctorToken);
  if (practitioners?.resourceType !== "Bundle" || !Array.isArray(practitioners.entry)) throw new Error("FHIR Practitioner search failed");
  console.log("✓ authenticated FHIR R4 gateway");
}

async function clinicalOrderCheck(patientToken, doctorToken, nurseToken) {
  const created = await request("/api/orders", doctorToken, {
    method: "POST",
    body: JSON.stringify({
      patientId: patientSeed.id,
      type: "lab",
      title: "CI Full blood count",
      code: "58410-2",
      codeSystem: "http://loinc.org",
      priority: "urgent",
      status: "draft",
      specimen: "Whole blood",
      clinicalReason: "Enterprise CPOE regression",
    }),
  });
  if (!created?.id || created.status !== "draft" || created.type !== "lab") throw new Error("Clinical order creation failed");

  const active = await request(`/api/orders/${created.id}`, doctorToken, {
    method: "PATCH",
    body: JSON.stringify({ status: "active" }),
  });
  if (active.status !== "active") throw new Error("Clinical order activation failed");

  const progressing = await request(`/api/orders/${created.id}`, nurseToken, {
    method: "PATCH",
    body: JSON.stringify({ status: "in_progress" }),
  });
  if (progressing.status !== "in_progress") throw new Error("Clinical order in-progress transition failed");

  const completed = await request(`/api/orders/${created.id}`, nurseToken, {
    method: "PATCH",
    body: JSON.stringify({ status: "completed", result: "Hb 13.4 g/dL · WBC 6.0 · Plt 251", resultFlag: "normal" }),
  });
  if (completed.status !== "completed" || !completed.completedAt || !completed.result) throw new Error("Clinical order completion/result failed");

  const patientOrders = await request("/api/orders", patientToken);
  if (!patientOrders.some((order) => order.id === created.id && order.status === "completed")) {
    throw new Error("Patient could not see completed clinical order");
  }
  console.log("✓ CPOE clinical order lifecycle (draft → active → in progress → completed)");
}

try {
  await waitForHealth();
  const patientToken = await login(patientSeed, "patient");
  const doctorToken = await login(doctorSeed, "doctor");
  const adminToken = await login(adminSeed, "admin");

  const nursePassword = `ci-nurse-${Date.now()}`;
  const nurse = await request("/api/admin/users", adminToken, {
    method: "POST",
    body: JSON.stringify({ name: "CI Pharmacy Nurse", email: `ci-nurse-${Date.now()}@carebridge.test`, password: nursePassword, role: "nurse", department: "Ridge Campus pharmacy" }),
  });
  const nurseToken = await login({ email: nurse.email, password: nursePassword }, "nurse");

  await checkJson("patient appointments", `/api/appointments?userId=${patientSeed.id}&role=patient`, patientToken);
  await checkJson("patient admissions", `/api/ward-bookings?userId=${patientSeed.id}&role=patient`, patientToken);
  await checkJson("patient billing", `/api/billing?userId=${patientSeed.id}&role=patient`, patientToken);
  await checkJson("patient contacts", `/api/contacts?userId=${patientSeed.id}&role=patient`, patientToken);
  await checkJson("patient prescriptions", `/api/prescriptions?userId=${patientSeed.id}&role=patient`, patientToken);
  await checkJson("patient chart", `/api/chart/${patientSeed.id}`, patientToken);
  await checkJson("patient notifications", `/api/notifications/${patientSeed.id}`, patientToken);
  await checkJson("patient badges", `/api/badges?userId=${patientSeed.id}&role=patient`, patientToken);
  await checkJson("patient experience", "/api/patient-experience", patientToken);

  await checkJson("doctor appointments", `/api/appointments?userId=${doctorSeed.id}&role=doctor`, doctorToken);
  await checkJson("doctor contacts", `/api/contacts?userId=${doctorSeed.id}&role=doctor`, doctorToken);
  await checkJson("doctor prescriptions", `/api/prescriptions?userId=${doctorSeed.id}&role=doctor`, doctorToken);
  await checkJson("doctor patient chart", `/api/chart/${patientSeed.id}`, doctorToken);
  await checkJson("doctor admissions", `/api/ward-bookings?userId=${doctorSeed.id}&role=doctor`, doctorToken);
  await checkJson("doctor badges", `/api/badges?userId=${doctorSeed.id}&role=doctor`, doctorToken);

  await checkJson("nurse contacts", `/api/contacts?userId=${nurse.id}&role=nurse`, nurseToken);
  await checkJson("nurse stock", "/api/pharmacy/stock?manage=1", nurseToken);
  await checkJson("nurse support", `/api/tickets?userId=${nurse.id}&role=nurse`, nurseToken);
  await checkJson("nurse badges", `/api/badges?userId=${nurse.id}&role=nurse`, nurseToken);

  await checkJson("admin directory", "/api/admin/users", adminToken);
  await checkJson("admin admissions", "/api/ward-bookings", adminToken);
  await checkJson("admin wards", "/api/wards", adminToken);
  await checkJson("admin reports", "/api/admin/reports", adminToken);
  await checkJson("admin audit", "/api/admin/audit", adminToken);
  await checkJson("admin payments", "/api/finance/payments", adminToken);
  await checkJson("admin cases", "/api/cases?status=open", adminToken);
  await checkJson("admin billing", "/api/billing?role=admin", adminToken);

  await fhirCheck(patientToken, doctorToken);
  await clinicalOrderCheck(patientToken, doctorToken, nurseToken);
  await patientExperienceCheck(patientToken, adminToken);
  await wardCapacityCheck(patientToken, adminToken);

  await socketCheck("patient", patientToken);
  await socketCheck("doctor", doctorToken);
  await socketCheck("nurse", nurseToken);
  await socketCheck("admin", adminToken);
  console.log("Premium V6 multi-role + enterprise runtime regression passed.");
} finally {
  stop();
}
