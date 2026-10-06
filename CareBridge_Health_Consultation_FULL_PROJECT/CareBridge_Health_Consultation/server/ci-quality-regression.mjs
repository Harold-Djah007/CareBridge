import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import express from "express";
import { ensureClinical } from "./clinical.js";
import { installSecurity } from "./security.js";
import { ensurePharmacy } from "./pharmacy.js";
import { createRuntimeStore } from "./runtimeStore.js";
import { passwordMatches } from "./auth.js";
import { newId } from "./ids.js";
import { rtcConfig } from "./rtc.js";
import { createHmac } from "node:crypto";

assert.equal(rtcConfig("patient", {}, 0).iceServers.length, 1);
const relay = rtcConfig("patient", { CAREBRIDGE_TURN_URLS: "turn:relay.example:3478,turns:relay.example:5349", CAREBRIDGE_TURN_SECRET: "test-secret" }, 0).iceServers[1];
assert.equal(relay.username, "3600:patient");
assert.equal(relay.credential, createHmac("sha1", "test-secret").update(relay.username).digest("base64"));
assert.equal(relay.urls.length, 2);
assert.throws(() => rtcConfig("patient", { CAREBRIDGE_TURN_URLS: "turn:relay.example" }));
assert.throws(() => rtcConfig("patient", { CAREBRIDGE_TURN_SECRET: "test-secret" }));
assert.throws(() => rtcConfig("patient", { CAREBRIDGE_TURN_URLS: "https://relay.example", CAREBRIDGE_TURN_SECRET: "test-secret" }));

const requireClient = createRequire(new URL("../client/package.json", import.meta.url));
const { io } = requireClient("socket.io-client");
assert.equal(passwordMatches("", undefined), false);
const identifiers = Array.from({ length: 10000 }, () => newId("apt"));
assert.equal(new Set(identifiers).size, identifiers.length);
assert.ok(identifiers.every((id) => !id.includes("-")));

const records = { medications: [], notes: [{ id: "real-note" }], invoices: [{ id: "real-invoice" }] };
ensureClinical(records);
assert.deepEqual(records.notes, [{ id: "real-note" }]);
assert.deepEqual(records.invoices, [{ id: "real-invoice" }]);
assert.equal(records.medications.length, 0);
const partial = { notes: [{ id: "existing" }] };
ensureClinical(partial);
assert.equal(partial.notes[0].id, "existing");
console.log("✓ empty medication lists and existing clinical records survive initialization");
const inventory = { users: [], pharmacyStock: [], prescriptions: [] };
ensurePharmacy(inventory);
assert.equal(inventory.pharmacyStock.length, 0);
const previousEnvironment = process.env.NODE_ENV;
process.env.NODE_ENV = "production";
try {
  const production = { users: [] };
  ensureClinical(production);
  ensurePharmacy(production);
  assert.equal(production.notes.length, 0);
  assert.equal(production.users.length, 0);
  assert.equal(production.pharmacyStock.length, 0);
} finally {
  if (previousEnvironment === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previousEnvironment;
}
console.log("✓ empty inventory stays empty; production normalization creates no demo clinical data or nurse accounts");

const app = express();
let persistence = { readable: true, error: "" };
installSecurity(app, { readiness: () => ({ persistence }) });
const healthServer = app.listen(0, "127.0.0.1");
await new Promise((resolve) => healthServer.once("listening", resolve));
try {
  const url = `http://127.0.0.1:${healthServer.address().port}/api/ready`;
  assert.equal((await fetch(url)).status, 200);
  for (const failure of [{ error: "database unavailable" }, { lastPing: { ok: false } }, { checksumValid: false }]) {
    persistence = { readable: true, ...failure };
    assert.equal((await fetch(url)).status, 503);
  }
  console.log("✓ readiness fails for persistence errors, failed database probes, and invalid checksums");
} finally { await new Promise((resolve) => healthServer.close(resolve)); }

// Load the browser API helper with only its build-time environment substituted.
const source = fs.readFileSync(new URL("../client/src/api.js", import.meta.url), "utf8").replaceAll("import.meta.env", "{}");
const originalFetch = globalThis.fetch;
globalThis.localStorage = { getItem: () => "test-token" };
globalThis.window = { location: { origin: "http://localhost" } };
try {
  let sent;
  globalThis.fetch = async (_url, options) => { sent = options; return { status: 200, ok: true, json: async () => ({ ok: true }) }; };
  const { api } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
  await api("/cart", { method: "POST", headers: { "X-Custom": "preserved" } });
  assert.equal(sent.headers.Authorization, "Bearer test-token");
  assert.equal(sent.headers["Content-Type"], "application/json");
  assert.equal(sent.headers["X-Custom"], "preserved");
  console.log("✓ custom API headers preserve authorization and content type");
} finally { globalThis.fetch = originalFetch; delete globalThis.localStorage; delete globalThis.window; }

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "carebridge-quality-"));
const dataFile = path.join(temp, "db.json");
fs.copyFileSync(process.env.DATA_FILE || new URL("./tests/fixtures/demo.json", import.meta.url), dataFile);
const localStore = await createRuntimeStore(dataFile);
const first = localStore.read();
const stale = localStore.read();
first.qualityMarker = "retained";
localStore.write(first);
assert.throws(() => localStore.write(stale), { code: "CAREBRIDGE_STALE_WRITE" });
assert.equal(localStore.read().qualityMarker, "retained");
await localStore.close();
console.log("✓ local persistence rejects stale writes instead of silently losing concurrent changes");
const seed = JSON.parse(fs.readFileSync(dataFile, "utf8"));
const port = Number(process.env.PORT || 5066);
const base = `http://127.0.0.1:${port}/api`;
const child = spawn(process.execPath, ["index.js"], {
  cwd: new URL(".", import.meta.url),
  env: { ...process.env, DATA_FILE: dataFile, PORT: String(port), LOG_LEVEL: "silent", CAREBRIDGE_BEHIND_TLS_PROXY: "false" },
  stdio: ["ignore", "pipe", "pipe"],
});
let logs = "";
child.stdout.on("data", (chunk) => { logs += chunk; });
child.stderr.on("data", (chunk) => { logs += chunk; });
const stop = () => child.kill();
process.on("exit", stop);

async function request(route, token, method = "GET", body) {
  return fetch(`${base}${route}`, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
const sockets = [];
try {
  let healthy = false;
  for (let attempt = 0; attempt < 50; attempt++) {
    if (child.exitCode !== null) throw new Error(logs);
    try { if ((await fetch(`${base}/health`)).ok) { healthy = true; break; } } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  assert.ok(healthy, logs);
  const sessions = {};
  for (const role of ["patient", "doctor", "admin"]) {
    const user = seed.users.find((row) => row.role === role && row.status !== "inactive");
    const response = await request("/login", "", "POST", { email: user.email, password: user.password, expectedRole: role });
    assert.equal(response.status, 200);
    sessions[role] = await response.json();
  }
  const { patient, doctor, admin } = sessions;
  assert.equal((await request("/vitals", doctor.token, "POST", { patientId: patient.user.id })).status, 400);
  assert.equal((await request("/vitals", doctor.token, "POST", { patientId: patient.user.id, hr: "NaN" })).status, 400);
  const observed = await request("/vitals", doctor.token, "POST", { patientId: patient.user.id, hr: 80 });
  assert.equal(observed.status, 201);
  const observation = await observed.json();
  assert.equal(observation.hr, 80);
  assert.equal(observation.temp, null);
  assert.equal(observation.spo2, null);
  console.log("✓ blank and invalid observations rejected; unmeasured vitals remain absent");
  assert.equal((await fetch(`${base}/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" })).status, 400);
  assert.equal((await request("/does-not-exist", patient.token)).status, 404);
  const invalidStock = await request("/pharmacy/stock", admin.token, "POST", { name: "Invalid stock", price: "NaN", qty: -1 });
  assert.equal(invalidStock.status, 400);
  const wards = await (await request("/wards", admin.token)).json();
  assert.equal((await request(`/wards/${wards[0].id}`, admin.token, "PATCH", { capacity: 1, available: 2 })).status, 400);
  assert.equal((await request(`/admin/users/${patient.user.id}`, admin.token, "PATCH", { role: "superadmin" })).status, 400);
  assert.equal((await request(`/admin/users/${patient.user.id}`, admin.token, "PATCH", { email: admin.user.email })).status, 409);
  console.log("✓ malformed JSON, missing endpoints, invalid stock/ward values, roles and duplicate emails rejected");
  const stock = await (await request("/pharmacy/stock?manage=1", admin.token)).json();
  const medicine = stock.find((item) => item.qty > 1 && item.available);
  assert.ok(medicine);
  const duplicateOrder = await request("/finance/pharmacy/order", patient.token, "POST", { items: [{ id: medicine.id, qty: medicine.qty }, { id: medicine.id, qty: medicine.qty }] });
  assert.equal(duplicateOrder.status, 409);
  assert.equal((await request("/cart/items", patient.token, "POST", { kind: "med", productId: medicine.id, qty: 1.5 })).status, 400);
  const afterStock = await (await request("/pharmacy/stock?manage=1", admin.token)).json();
  assert.equal(afterStock.find((item) => item.id === medicine.id).qty, medicine.qty);
  console.log("✓ duplicate order lines cannot oversell stock and fractional cart quantities are rejected");

  const appointment = { patientId: patient.user.id, doctorId: doctor.user.id, date: "2099-12-18", time: "14:30", mode: "video" };
  assert.equal((await request("/appointments", patient.token, "POST", { ...appointment, date: "2099-02-30" })).status, 400);
  const booked = await request("/appointments", patient.token, "POST", appointment);
  assert.equal(booked.status, 201);
  const row = await booked.json();
  assert.equal((await request("/appointments", patient.token, "POST", appointment)).status, 409);
  assert.equal((await request(`/appointments/${row.id}`, patient.token, "PATCH", { status: "completed" })).status, 403);
  assert.equal((await request(`/appointments/${row.id}`, patient.token, "PATCH", { status: "cancelled" })).status, 200);
  console.log("✓ impossible dates, double bookings and patient-forged completion rejected; cancellation works");

  const socket = io(`http://127.0.0.1:${port}`, { auth: { token: patient.token }, transports: ["websocket"], reconnection: false });
  sockets.push(socket);
  await new Promise((resolve, reject) => { socket.once("connect", resolve); socket.once("connect_error", reject); setTimeout(() => reject(new Error("Socket connection timeout")), 5000).unref(); });
  const room = [patient.user.id, doctor.user.id].sort().join("-");
  const accepted = await socket.timeout(3000).emitWithAck("join-room", room);
  assert.equal(accepted.ok, true);
  assert.equal((await socket.timeout(3000).emitWithAck("join-room", `${patient.user.id}-nonexistent`)).ok, false);
  assert.equal((await socket.timeout(3000).emitWithAck("chat-message", { roomId: room, text: "Quality regression message" })).ok, true);
  assert.equal((await socket.timeout(3000).emitWithAck("chat-message", { roomId: room, text: "x".repeat(4001) })).ok, false);
  socket.emit("webrtc-offer", null);
  const disconnected = new Promise((resolve, reject) => { socket.once("disconnect", resolve); setTimeout(() => reject(new Error("Revoked socket stayed active")), 5000).unref(); });
  assert.equal((await request("/logout", patient.token, "POST", {})).status, 200);
  await disconnected;
  console.log("✓ socket rooms require real participants and revoked sessions lose realtime access");

  for (let attempt = 0; attempt < 7; attempt++) {
    const response = await fetch(`${base}/login`, { method: "POST", headers: { "Content-Type": "application/json", "X-Forwarded-For": `203.0.113.${attempt + 1}` }, body: JSON.stringify({ email: "unknown@test.invalid", password: "incorrect" }) });
    if (attempt >= 5) assert.equal(response.status, 429);
  }
  console.log("✓ forged forwarded IPs cannot bypass login throttling when proxy trust is disabled");
  console.log("CareBridge targeted quality regression passed.");
} finally {
  sockets.forEach((socket) => socket.disconnect());
  child.kill();
  await new Promise((resolve) => { if (child.exitCode !== null) resolve(); else child.once("exit", resolve); });
  process.removeListener("exit", stop);
  fs.rmSync(temp, { recursive: true, force: true });
}
