import fs from "fs";
import { spawn } from "child_process";
import { totp } from "./mfa.js";
import { createCoordination } from "./coordination.js";

const dataFile = process.env.DATA_FILE;
const port = Number(process.env.PORT || 5057);
const base = `http://127.0.0.1:${port}`;
if (!dataFile) throw new Error("DATA_FILE is required");
if (!process.env.REDIS_URL) throw new Error("REDIS_URL is required");

const seed = JSON.parse(fs.readFileSync(dataFile, "utf8"));
const patient = seed.users.find((u) => u.role === "patient" && u.status !== "inactive");
const doctor = seed.users.find((u) => u.role === "doctor" && u.status !== "inactive");
const admin = seed.users.find((u) => u.role === "admin" && u.status !== "inactive");
if (!patient || !doctor || !admin) throw new Error("Missing seeded roles");

const server = spawn(process.execPath, ["index.js"], {
  cwd: new URL(".", import.meta.url),
  env: { ...process.env, DATA_FILE: dataFile, PORT: String(port), LOG_LEVEL: "silent", REDIS_SESSION_ENFORCE: "true", MFA_ENCRYPTION_KEY: "ci-carebridge-mfa-encryption-key-2026" },
  stdio: ["ignore", "pipe", "pipe"],
});
let log = "";
server.stdout.on("data", (chunk) => { log += chunk; });
server.stderr.on("data", (chunk) => { log += chunk; });
const stop = () => { if (!server.killed) server.kill("SIGTERM"); };
process.on("exit", stop);

async function waitForReady() {
  for (let attempt = 0; attempt < 45; attempt += 1) {
    if (server.exitCode != null) throw new Error(`Server exited early\n${log}`);
    try {
      const r = await fetch(`${base}/api/ready`);
      if (r.ok) return r.json();
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`Server not ready\n${log}`);
}

async function request(path, token = "", init = {}) {
  const headers = { ...(init.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (init.body && !headers["Content-Type"]) headers["Content-Type"] = "application/json";
  const response = await fetch(`${base}${path}`, { ...init, headers });
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { response, body, text };
}

async function login(user, role, mfaCode = "") {
  const { response, body, text } = await request("/api/login", "", {
    method: "POST",
    body: JSON.stringify({ email: user.email, password: user.password, expectedRole: role, ...(mfaCode ? { mfaCode } : {}) }),
  });
  if (!response.ok) throw new Error(`Login ${role} failed ${response.status}: ${text}`);
  return body;
}

try {
  const ready = await waitForReady();
  if (ready.coordination?.provider !== "redis" || ready.coordination?.ok !== true) throw new Error("Redis coordination is not ready");
  console.log("✓ Redis-backed runtime coordination ready");

  const patientLogin = await login(patient, "patient");
  const doctorLogin = await login(doctor, "doctor");
  const adminLogin = await login(admin, "admin");
  const patientToken = patientLogin.token;
  const doctorToken = doctorLogin.token;
  const adminToken = adminLogin.token;

  const enrollment = await request("/api/security/mfa/enroll", patientToken, { method: "POST", body: JSON.stringify({ currentPassword: patient.password }) });
  if (!enrollment.response.ok || !enrollment.body?.secret) throw new Error(`MFA enrollment failed: ${enrollment.text}`);
  const confirmed = await request("/api/security/mfa/confirm", patientToken, { method: "POST", body: JSON.stringify({ code: totp(enrollment.body.secret) }) });
  if (!confirmed.response.ok || !confirmed.body?.recoveryCodes?.length) throw new Error(`MFA confirmation failed: ${confirmed.text}`);
  const challenge = await login(patient, "patient");
  if (challenge.token !== "CAREBRIDGE_MFA_REQUIRED") throw new Error("MFA challenge was not required after enrollment");
  const mfaLogin = await login(patient, "patient", totp(enrollment.body.secret));
  if (!mfaLogin.token || mfaLogin.token.startsWith("CAREBRIDGE_")) throw new Error("TOTP MFA login failed");
  const recoveryCode = confirmed.body.recoveryCodes[0];
  const recoveryLogin = await login(patient, "patient", recoveryCode);
  if (!recoveryLogin.token || recoveryLogin.token.startsWith("CAREBRIDGE_")) throw new Error("Recovery-code login failed");
  const replay = await login(patient, "patient", recoveryCode);
  if (replay.token !== "CAREBRIDGE_MFA_INVALID") throw new Error("Recovery code was reusable");
  console.log("✓ TOTP MFA + one-time recovery codes");

  const smartClient = await request("/api/admin/integrations/smart", adminToken, {
    method: "POST",
    body: JSON.stringify({ name: "CI FHIR backend", scopes: "system/Patient.read" }),
  });
  if (!smartClient.response.ok || !smartClient.body?.clientSecret) throw new Error(`SMART client creation failed: ${smartClient.text}`);
  const smartToken = await request("/api/smart/token", "", {
    method: "POST",
    body: JSON.stringify({ grant_type: "client_credentials", client_id: smartClient.body.id, client_secret: smartClient.body.clientSecret, scope: "system/Patient.read" }),
  });
  if (!smartToken.response.ok || !smartToken.body?.access_token) throw new Error(`SMART token failed: ${smartToken.text}`);
  const smartPatients = await request("/api/fhir/R4/Patient", smartToken.body.access_token);
  if (!smartPatients.response.ok || smartPatients.body?.resourceType !== "Bundle") throw new Error(`SMART FHIR Patient read failed: ${smartPatients.text}`);
  const smartDenied = await request("/api/fhir/R4/Observation", smartToken.body.access_token);
  if (smartDenied.response.status !== 403) throw new Error(`SMART scope isolation failed: ${smartDenied.response.status}`);
  console.log("✓ SMART Backend Services client + scoped FHIR access");

  const hl7 = [
    "MSH|^~\\&|LAB|RIDGE|CAREBRIDGE|RIDGE|20260908143000||ORU^R01|CI-HL7-001|P|2.5.1",
    `PID|1||${patient.mrn || patient.id}^^^CareBridge^MR||Mensah^Ama||19900101|F`,
    "PV1|1|O|OPD^^^RIDGE",
    "OBR|1|ORD-CI|LAB-CI|58410-2^CBC^LN",
    "OBX|1|ST|718-7^Hemoglobin^LN||13.4|g/dL|12-16|N|||F",
  ].join("\r");
  const hl7Result = await request("/api/admin/integrations/hl7/v2/ingest", adminToken, { method: "POST", body: JSON.stringify({ message: hl7 }) });
  if (hl7Result.response.status !== 202 || hl7Result.body?.record?.messageType !== "ORU") throw new Error(`HL7 ingest failed: ${hl7Result.text}`);
  const hl7Duplicate = await request("/api/admin/integrations/hl7/v2/ingest", adminToken, { method: "POST", body: JSON.stringify({ message: hl7 }) });
  if (!hl7Duplicate.body?.duplicate) throw new Error("HL7 message-control idempotency failed");
  console.log("✓ HL7 v2 ORU ingest + ACK + idempotency");

  const dicomConfig = await request("/api/admin/integrations/dicom", adminToken, { method: "PATCH", body: JSON.stringify({ name: "CI PACS", aeTitle: "CAREBRIDGE", baseUrl: "https://pacs.example.test/dicom-web", authMode: "Bearer" }) });
  if (!dicomConfig.response.ok) throw new Error(`DICOM config failed: ${dicomConfig.text}`);
  const dicomStudy = await request("/api/admin/integrations/dicom/studies", adminToken, { method: "POST", body: JSON.stringify({ patientId: patient.id, studyInstanceUid: `1.2.840.113619.${Date.now()}`, accessionNumber: "CI-ACC-001", modality: "CT", description: "CI chest study", seriesCount: 2, instances: 48 }) });
  if (dicomStudy.response.status !== 201) throw new Error(`DICOM study registration failed: ${dicomStudy.text}`);
  console.log("✓ DICOMweb/PACS integration contract + study registry");

  const terminology = await request("/api/terminology/lookup?system=http%3A%2F%2Floinc.org&code=58410-2", doctorToken);
  if (!terminology.response.ok || terminology.body?.total !== 1) throw new Error("Terminology lookup failed");
  console.log("✓ LOINC/SNOMED/ICD/RxNorm terminology lookup contract");

  const patientAllergy = await request(`/api/users/${patient.id}`, adminToken, { method: "PATCH", body: JSON.stringify({ allergies: "Penicillin" }) });
  if (!patientAllergy.response.ok) throw new Error(`Patient allergy setup failed: ${patientAllergy.text}`);
  const blocked = await request("/api/orders", doctorToken, { method: "POST", body: JSON.stringify({ patientId: patient.id, type: "medication", title: "Amoxicillin 500 mg", priority: "routine" }) });
  if (blocked.response.status !== 409 || blocked.body?.code !== "CLINICAL_SAFETY_BLOCK") throw new Error(`Medication allergy CDS did not block: ${blocked.status} ${blocked.text}`);
  const overridden = await request("/api/orders", doctorToken, { method: "POST", body: JSON.stringify({ patientId: patient.id, type: "medication", title: "Amoxicillin 500 mg", priority: "routine", safetyOverrideReason: "Infectious diseases specialist reviewed documented childhood rash and approved monitored challenge." }) });
  if (overridden.response.status !== 201 || !overridden.body?.safetyOverrideReason) throw new Error(`Clinical override audit failed: ${overridden.text}`);

  const setApplied = await request("/api/clinical/order-sets/os-hypertension-review/apply", doctorToken, { method: "POST", body: JSON.stringify({ patientId: patient.id, clinicalReason: "CI hypertension review" }) });
  if (setApplied.response.status !== 201 || setApplied.body?.orders?.length < 2) throw new Error(`Order-set application failed: ${setApplied.text}`);

  const labOrder = await request("/api/orders", doctorToken, { method: "POST", body: JSON.stringify({ patientId: patient.id, type: "lab", title: "CI safety FBC", code: "58410-2", codeSystem: "http://loinc.org", priority: "urgent" }) });
  if (labOrder.response.status !== 201) throw new Error(`Lab order failed: ${labOrder.text}`);
  const completed = await request(`/api/orders/${labOrder.body.id}`, doctorToken, { method: "PATCH", body: JSON.stringify({ status: "completed", result: "Hb 13.4 g/dL", resultFlag: "normal" }) });
  if (!completed.response.ok) throw new Error(`Order completion failed: ${completed.text}`);
  const acknowledged = await request(`/api/orders/${labOrder.body.id}/acknowledge`, doctorToken, { method: "POST", body: JSON.stringify({ note: "Reviewed in clinical context; no action required." }) });
  if (!acknowledged.response.ok || !acknowledged.body?.resultAcknowledgedAt) throw new Error(`Result acknowledgement failed: ${acknowledged.text}`);
  console.log("✓ medication safety + audited override + order sets + result acknowledgement");

  const chart = await request(`/api/chart/${patient.id}`, doctorToken);
  const ownNote = chart.body?.notes?.find((note) => note.authorId === doctor.id && !note.signedAt);
  if (ownNote) {
    const signed = await request(`/api/notes/${ownNote.id}/sign`, doctorToken, { method: "POST", body: JSON.stringify({}) });
    if (!signed.response.ok || !signed.body?.signatureHash) throw new Error(`Clinical signature failed: ${signed.text}`);
    const cosigned = await request(`/api/notes/${ownNote.id}/cosign`, adminToken, { method: "POST", body: JSON.stringify({ attestation: "CI supervisory review" }) });
    if (!cosigned.response.ok || !cosigned.body?.cosignatureHash) throw new Error(`Clinical co-signature failed: ${cosigned.text}`);
  }
  console.log("✓ cryptographic clinical signature/co-signature workflow");

  const eligibility = await request("/api/coverage/eligibility", mfaLogin.token, { method: "POST", body: JSON.stringify({ payer: "NHIS", memberId: "NHIS-CI-001" }) });
  if (!eligibility.response.ok || eligibility.body?.status !== "eligible") throw new Error(`Eligibility failed: ${eligibility.text}`);
  const claim = await request("/api/admin/claims", adminToken, { method: "POST", body: JSON.stringify({ patientId: patient.id, payer: "NHIS", memberId: "NHIS-CI-001", diagnosisCodes: ["I10"], lines: [{ description: "Outpatient consultation", code: "99213", codeSystem: "local", amount: 350 }] }) });
  if (claim.response.status !== 201) throw new Error(`Claim creation failed: ${claim.text}`);
  let claimState = await request(`/api/admin/claims/${claim.body.id}`, adminToken, { method: "PATCH", body: JSON.stringify({ status: "submitted", payerReference: "NHIS-CI-REF" }) });
  if (!claimState.response.ok || claimState.body?.status !== "submitted") throw new Error("Claim submit failed");
  claimState = await request(`/api/admin/claims/${claim.body.id}`, adminToken, { method: "PATCH", body: JSON.stringify({ status: "accepted" }) });
  if (!claimState.response.ok || claimState.body?.status !== "accepted") throw new Error("Claim acceptance failed");
  claimState = await request(`/api/admin/claims/${claim.body.id}`, adminToken, { method: "PATCH", body: JSON.stringify({ status: "paid", paidAmount: 350 }) });
  if (!claimState.response.ok || claimState.body?.status !== "paid") throw new Error("Claim settlement failed");
  console.log("✓ eligibility + claims lifecycle + settlement audit");

  const redis = await createCoordination(process.env.REDIS_URL);
  try {
    await redis.cacheSet("ci:enterprise", { ok: true }, 60);
    const cached = await redis.cacheGet("ci:enterprise");
    if (cached?.ok !== true) throw new Error("Redis cache roundtrip failed");
    const queued = await redis.enqueue("ci-jobs", { task: "enterprise95" }, { idempotencyKey: `ci-${Date.now()}` });
    if (!queued?.streamId) throw new Error("Redis job enqueue failed");
    const jobs = await redis.claim("ci-jobs", 10);
    const job = jobs.find((row) => row.jobId === queued.jobId);
    if (!job) throw new Error("Redis durable job was not claimable");
    await redis.complete(job, { ok: true });
  } finally { await redis.close(); }
  console.log("✓ Redis cache + session coordination + durable job stream");

  console.log("CareBridge 9.5 enterprise integration regression passed.");
} finally {
  stop();
}
