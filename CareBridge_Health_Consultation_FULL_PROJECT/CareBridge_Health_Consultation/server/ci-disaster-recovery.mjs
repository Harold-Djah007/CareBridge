import fs from "fs";
import os from "os";
import path from "path";
import { createPostgresRepository } from "./postgres.js";
import { exportRecoverySnapshot, inspectRecoverySnapshot, restoreRecoverySnapshot } from "./disasterRecovery.js";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
if (!process.env.DATA_FILE) throw new Error("DATA_FILE is required");
const key = process.env.BACKUP_ENCRYPTION_KEY || "ci-backup-key-2026-carebridge";
const seed = JSON.parse(fs.readFileSync(process.env.DATA_FILE, "utf8"));
const repo = createPostgresRepository(process.env.DATABASE_URL);
const snapshotPath = path.join(os.tmpdir(), `carebridge-dr-${Date.now()}.json`);

try {
  await repo.migrate();
  const current = await repo.loadState();
  if (!current) await repo.seedIfEmpty(seed);
} finally {
  await repo.close();
}

const beforeRepo = createPostgresRepository(process.env.DATABASE_URL);
let before;
try { before = await beforeRepo.loadState(); } finally { await beforeRepo.close(); }
if (!before) throw new Error("Missing PostgreSQL state before DR drill");

const exported = await exportRecoverySnapshot({ databaseUrl: process.env.DATABASE_URL, destination: snapshotPath, encryptionKey: key });
if (!exported.encrypted || !exported.payloadChecksum || !fs.existsSync(snapshotPath)) throw new Error("Encrypted DR snapshot export failed");
const inspected = await inspectRecoverySnapshot({ source: snapshotPath, encryptionKey: key });
if (inspected.payloadChecksum !== exported.payloadChecksum || inspected.sourceVersion !== before.version) throw new Error("DR snapshot verification failed");
console.log(`✓ encrypted, checksummed recovery snapshot at version ${before.version}`);

const mutateRepo = createPostgresRepository(process.env.DATABASE_URL);
let mutated;
try {
  const state = await mutateRepo.loadState();
  const payload = structuredClone(state.payload);
  payload.__drMutation = { at: new Date().toISOString(), shouldDisappear: true };
  mutated = await mutateRepo.saveState(payload, { expectedVersion: state.version });
} finally { await mutateRepo.close(); }
if (!mutated?.version) throw new Error("DR mutation failed");

const restored = await restoreRecoverySnapshot({ databaseUrl: process.env.DATABASE_URL, source: snapshotPath, encryptionKey: key, expectedCurrentVersion: mutated.version });
if (!restored.restored || restored.payloadChecksum !== exported.payloadChecksum) throw new Error("DR restore command failed");

const verifyRepo = createPostgresRepository(process.env.DATABASE_URL);
try {
  const after = await verifyRepo.loadState();
  if (after.payload?.__drMutation) throw new Error("DR restore did not recover the snapshot state");
  if (!Array.isArray(after.payload?.users) || after.payload.users.length !== before.payload.users.length) throw new Error("DR restore user-state verification failed");
  console.log(`✓ restore drill recovered application state into PostgreSQL version ${after.version}`);
  const outbox = await verifyRepo.claimOutbox(100);
  if (!outbox.some((event) => event.topic === "system.recovery-restored")) throw new Error("DR restore outbox event missing");
  console.log("✓ recovery action emitted durable outbox evidence");
} finally {
  await verifyRepo.close();
  fs.rmSync(snapshotPath, { force: true });
}

console.log("CareBridge disaster-recovery snapshot drill passed.");
