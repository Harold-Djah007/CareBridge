import fs from "fs";
import { spawn } from "child_process";

const dataFile = process.env.DATA_FILE;
const port = Number(process.env.PORT || 5060);
const base = `http://127.0.0.1:${port}`;
if (!dataFile) throw new Error("DATA_FILE is required");
const seed = JSON.parse(fs.readFileSync(dataFile, "utf8"));
const patient = seed.users.find((user) => user.role === "patient" && user.status !== "inactive");
if (!patient) throw new Error("Seed patient missing");

const server = spawn(process.execPath, ["index.js"], {
  cwd: new URL(".", import.meta.url),
  env: { ...process.env, DATA_FILE: dataFile, PORT: String(port), LOG_LEVEL: "silent" },
  stdio: ["ignore", "pipe", "pipe"],
});
let log = "";
let childExit = null;
server.stdout.on("data", (chunk) => { log += chunk; });
server.stderr.on("data", (chunk) => { log += chunk; });
server.on("exit", (code, signal) => { childExit = { code, signal, at: new Date().toISOString() }; });
const stop = () => { if (server.exitCode == null && server.signalCode == null) server.kill("SIGTERM"); };
process.on("exit", stop);

function errorDetail(error) {
  const cause = error?.cause;
  return [
    error?.message || String(error),
    cause?.code ? `code=${cause.code}` : "",
    cause?.errno ? `errno=${cause.errno}` : "",
    cause?.syscall ? `syscall=${cause.syscall}` : "",
    cause?.address ? `address=${cause.address}` : "",
    cause?.port ? `port=${cause.port}` : "",
    cause?.message ? `cause=${cause.message}` : "",
  ].filter(Boolean).join(" ");
}

async function waitForReady() {
  let lastStatus = 0;
  let lastBody = "";
  let lastError = "";
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (server.exitCode != null || server.signalCode != null || childExit) {
      throw new Error(`Server exited early ${JSON.stringify(childExit || { code: server.exitCode, signal: server.signalCode })}\n${log}`);
    }
    try {
      const response = await fetch(`${base}/api/ready`);
      lastStatus = response.status;
      lastBody = await response.text();
      lastError = "";
      if (response.ok) return;
    } catch (error) {
      lastError = errorDetail(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Server not ready (status=${lastStatus}, body=${lastBody || "<empty>"}, fetchError=${lastError || "<none>"}, child=${JSON.stringify(childExit || { exitCode: server.exitCode, signalCode: server.signalCode })})\n${log}`);
}

async function request(path, token = "") {
  const started = performance.now();
  const response = await fetch(`${base}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  const elapsed = performance.now() - started;
  await response.arrayBuffer();
  return { status: response.status, elapsed, requestId: response.headers.get("x-request-id"), traceparent: response.headers.get("traceparent") };
}

function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * p) - 1));
  return sorted[index];
}

try {
  await waitForReady();
  const login = await fetch(`${base}/api/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: patient.email, password: patient.password, expectedRole: "patient" }) });
  const auth = await login.json();
  if (!login.ok || !auth.token) throw new Error(`Load-test login failed ${login.status}`);

  const total = 180;
  const concurrency = 18;
  const results = [];
  let cursor = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= total) return;
      const path = index % 3 === 0
        ? `/api/badges?userId=${patient.id}&role=patient`
        : index % 3 === 1
          ? `/api/appointments?userId=${patient.id}&role=patient`
          : `/api/notifications/${patient.id}`;
      results.push(await request(path, auth.token));
    }
  });
  await Promise.all(workers);

  const failures = results.filter((row) => row.status >= 500 || row.status < 200 || row.status >= 300);
  const missingCorrelation = results.filter((row) => !row.requestId || !row.traceparent);
  const timings = results.map((row) => row.elapsed);
  const p50 = percentile(timings, 0.5);
  const p95 = percentile(timings, 0.95);
  const p99 = percentile(timings, 0.99);
  const max = Math.max(...timings);
  if (failures.length) throw new Error(`${failures.length}/${total} authenticated load requests failed; statuses=${JSON.stringify(failures.reduce((acc, row) => ({ ...acc, [row.status]: (acc[row.status] || 0) + 1 }), {}))}`);
  if (missingCorrelation.length) throw new Error(`${missingCorrelation.length}/${total} load responses lacked request/trace correlation`);
  if (p95 > Number(process.env.CI_P95_BUDGET_MS || 1000)) throw new Error(`P95 ${p95.toFixed(1)}ms exceeded SLO budget`);
  console.log(`✓ authenticated concurrency: ${total} requests @ ${concurrency} workers, 0 errors`);
  console.log(`✓ latency SLO: p50=${p50.toFixed(1)}ms p95=${p95.toFixed(1)}ms p99=${p99.toFixed(1)}ms max=${max.toFixed(1)}ms`);
  console.log("✓ every load response carried X-Request-Id + W3C traceparent");

  const admin = seed.users.find((user) => user.role === "admin" && user.status !== "inactive");
  const adminLogin = await fetch(`${base}/api/login`, { method: "POST", headers: { "Content-Type": "application/json", "X-Forwarded-For": "198.51.100.180" }, body: JSON.stringify({ email: admin.email, password: admin.password, expectedRole: "admin" }) });
  const adminAuth = await adminLogin.json();
  if (!adminLogin.ok || !adminAuth.token) throw new Error("Admin SLO login failed");
  const metricsResponse = await fetch(`${base}/api/admin/system/metrics`, { headers: { Authorization: `Bearer ${adminAuth.token}` } });
  const metrics = await metricsResponse.json();
  if (!metricsResponse.ok || Number(metrics.http?.requests || 0) < total || !metrics.http?.routes || Object.keys(metrics.http.routes).length < 2) throw new Error("Admin SLO metrics did not capture load telemetry");
  console.log("✓ Admin operations metrics captured per-route latency/error SLO telemetry");

  console.log("CareBridge authenticated load/SLO regression passed.");
} finally {
  stop();
}
