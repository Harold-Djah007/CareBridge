import fs from "fs";
import { spawn } from "child_process";
import pg from "pg";

const { Pool } = pg;
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
if (!process.env.DATA_FILE) throw new Error("DATA_FILE is required");

const seed = JSON.parse(fs.readFileSync(process.env.DATA_FILE, "utf8"));
const patient = seed.users.find((user) => user.role === "patient" && user.status !== "inactive");
if (!patient?.email || !patient?.password) throw new Error("Seed patient credentials missing");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function resetPrimary() {
  await pool.query("DELETE FROM carebridge_outbox").catch(() => {});
  await pool.query("DELETE FROM carebridge_audit_events").catch(() => {});
  await pool.query("DELETE FROM carebridge_state WHERE id = 'primary'").catch(() => {});
}

function start(port) {
  const child = spawn(process.execPath, ["index.js"], {
    cwd: new URL(".", import.meta.url),
    env: {
      ...process.env,
      PORT: String(port),
      DATA_FILE: process.env.DATA_FILE,
      PERSISTENCE_PROVIDER: "postgres",
      LOG_LEVEL: "silent",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let log = "";
  child.stdout.on("data", (chunk) => { log += chunk; });
  child.stderr.on("data", (chunk) => { log += chunk; });
  return { child, getLog: () => log };
}

async function waitForReady(instance, port) {
  const base = `http://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (instance.child.exitCode != null) throw new Error(`CareBridge runtime exited early\n${instance.getLog()}`);
    try {
      const response = await fetch(`${base}/api/ready`);
      if (response.ok) return { base, ready: await response.json() };
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`CareBridge PostgreSQL runtime did not become ready\n${instance.getLog()}`);
}

async function request(base, path, token = "", init = {}) {
  const headers = { ...(init.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (init.body && !headers["Content-Type"]) headers["Content-Type"] = "application/json";
  const response = await fetch(`${base}${path}`, { ...init, headers });
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { response, body, text };
}

async function requestWithDiagnostics(instance, base, path, token = "", init = {}) {
  try {
    return await request(base, path, token, init);
  } catch (error) {
    const state = instance?.child?.exitCode == null ? "running" : `exited(${instance.child.exitCode})`;
    throw new Error(`PostgreSQL runtime request ${init.method || "GET"} ${path} terminated while server was ${state}: ${error.message}\n--- CareBridge child log ---\n${instance?.getLog?.() || "<no child log>"}`);
  }
}

async function login(instance, base) {
  const result = await requestWithDiagnostics(instance, base, "/api/login", "", {
    method: "POST",
    body: JSON.stringify({ email: patient.email, password: patient.password, expectedRole: "patient" }),
  });
  if (!result.response.ok || !result.body?.token) throw new Error(`PostgreSQL runtime login failed: ${result.response.status} ${result.text}\n${instance.getLog()}`);
  return result.body;
}

async function stop(instance) {
  if (instance.child.exitCode != null) return;
  instance.child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => instance.child.once("exit", resolve)),
    new Promise((_, reject) => setTimeout(() => reject(new Error("Server did not stop gracefully")), 6000)),
  ]);
}

let first;
let second;
try {
  await resetPrimary();

  first = start(5058);
  const one = await waitForReady(first, 5058);
  if (one.ready?.persistence?.provider !== "postgres" || one.ready?.persistence?.primaryRuntime !== true) {
    throw new Error(`PostgreSQL was not primary runtime: ${JSON.stringify(one.ready?.persistence)}`);
  }
  console.log("✓ PostgreSQL promoted to primary CareBridge runtime");

  const auth1 = await login(first, one.base);
  const marker = `CI-PG-${Date.now()}`;
  const patch = await requestWithDiagnostics(first, one.base, `/api/users/${auth1.user.id}`, auth1.token, {
    method: "PATCH",
    body: JSON.stringify({ city: marker }),
  });
  if (!patch.response.ok || patch.body?.city !== marker) throw new Error(`PostgreSQL runtime mutation failed: ${patch.response.status} ${patch.text}\n${first.getLog()}`);

  const rowAfterWrite = await pool.query("SELECT version, payload FROM carebridge_state WHERE id = 'primary'");
  if (!rowAfterWrite.rowCount || rowAfterWrite.rows[0].payload?.users?.find((user) => user.id === auth1.user.id)?.city !== marker) {
    throw new Error(`API mutation was not durably committed to PostgreSQL\n${first.getLog()}`);
  }
  console.log(`✓ API mutation durably committed at PostgreSQL version ${rowAfterWrite.rows[0].version}`);

  await stop(first);
  first = null;

  second = start(5059);
  const two = await waitForReady(second, 5059);
  const auth2 = await login(second, two.base);
  if (auth2.user?.city !== marker) throw new Error(`PostgreSQL restart lost API state: ${auth2.user?.city}\n${second.getLog()}`);
  console.log("✓ CareBridge restart reloads state from PostgreSQL system of record");

  const sessions = await requestWithDiagnostics(second, two.base, "/api/security/sessions", auth2.token);
  if (!sessions.response.ok || !Array.isArray(sessions.body?.sessions)) throw new Error(`PostgreSQL-backed session state unavailable after restart\n${second.getLog()}`);
  console.log("✓ authenticated session state persists through PostgreSQL runtime restart");

  console.log("CareBridge PostgreSQL primary-runtime regression passed.");
} finally {
  if (first) await stop(first).catch(() => {});
  if (second) await stop(second).catch(() => {});
  await pool.end();
}
