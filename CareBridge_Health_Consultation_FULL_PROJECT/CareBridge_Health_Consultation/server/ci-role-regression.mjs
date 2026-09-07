import fs from "fs";
import { spawn } from "child_process";
import { io } from "socket.io-client";

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

  await socketCheck("patient", patientToken);
  await socketCheck("doctor", doctorToken);
  await socketCheck("nurse", nurseToken);
  await socketCheck("admin", adminToken);
  console.log("Premium V6 multi-role runtime regression passed.");
} finally {
  stop();
}
