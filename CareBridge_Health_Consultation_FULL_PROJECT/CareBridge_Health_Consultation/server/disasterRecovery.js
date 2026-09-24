import crypto from "crypto";
import fs from "fs";
import path from "path";
import { createPostgresRepository } from "./postgres.js";

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");

function keyFrom(value = process.env.BACKUP_ENCRYPTION_KEY) {
  if (!value) return null;
  return crypto.createHash("sha256").update(String(value)).digest();
}

function encrypt(raw, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([cipher.update(raw, "utf8"), cipher.final()]);
  return {
    encrypted: true,
    algorithm: "AES-256-GCM",
    iv: iv.toString("base64url"),
    tag: cipher.getAuthTag().toString("base64url"),
    body: body.toString("base64url"),
  };
}

function decrypt(envelope, key) {
  if (!envelope.encrypted) return envelope.body;
  if (!key) throw new Error("BACKUP_ENCRYPTION_KEY is required to restore this snapshot.");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(envelope.iv, "base64url"));
  decipher.setAuthTag(Buffer.from(envelope.tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(envelope.body, "base64url")), decipher.final()]).toString("utf8");
}

export async function exportRecoverySnapshot({ databaseUrl = process.env.DATABASE_URL, destination, encryptionKey = process.env.BACKUP_ENCRYPTION_KEY } = {}) {
  if (!databaseUrl) throw new Error("DATABASE_URL is required.");
  if (!destination) throw new Error("Snapshot destination is required.");
  const repo = createPostgresRepository(databaseUrl);
  try {
    await repo.migrate();
    const state = await repo.loadState();
    if (!state) throw new Error("No CareBridge PostgreSQL state exists to back up.");
    const payloadRaw = stable(state.payload);
    const snapshot = {
      format: "carebridge-recovery-v1",
      exportedAt: new Date().toISOString(),
      sourceVersion: state.version,
      payloadChecksum: sha256(payloadRaw),
      payload: state.payload,
    };
    const raw = JSON.stringify(snapshot);
    const key = keyFrom(encryptionKey);
    const envelope = key ? encrypt(raw, key) : { encrypted: false, algorithm: "none", body: raw };
    const wrapper = JSON.stringify({ format: "carebridge-recovery-envelope-v1", ...envelope, envelopeChecksum: sha256(stable(envelope)) }, null, 2);
    fs.mkdirSync(path.dirname(path.resolve(destination)), { recursive: true });
    fs.writeFileSync(destination, `${wrapper}\n`, { encoding: "utf8", mode: 0o600 });
    return { destination: path.resolve(destination), sourceVersion: state.version, payloadChecksum: snapshot.payloadChecksum, encrypted: Boolean(key), bytes: Buffer.byteLength(wrapper) };
  } finally {
    await repo.close();
  }
}

export async function inspectRecoverySnapshot({ source, encryptionKey = process.env.BACKUP_ENCRYPTION_KEY } = {}) {
  if (!source) throw new Error("Snapshot source is required.");
  const wrapper = JSON.parse(fs.readFileSync(source, "utf8"));
  if (wrapper.format !== "carebridge-recovery-envelope-v1") throw new Error("Unsupported CareBridge recovery snapshot.");
  const { envelopeChecksum, format, ...envelope } = wrapper;
  if (envelopeChecksum !== sha256(stable(envelope))) throw new Error("Recovery envelope checksum mismatch.");
  const raw = decrypt(envelope, keyFrom(encryptionKey));
  const snapshot = JSON.parse(raw);
  if (snapshot.format !== "carebridge-recovery-v1") throw new Error("Invalid recovery snapshot payload.");
  if (sha256(stable(snapshot.payload)) !== snapshot.payloadChecksum) throw new Error("Recovery payload checksum mismatch.");
  return snapshot;
}

export async function restoreRecoverySnapshot({ databaseUrl = process.env.DATABASE_URL, source, encryptionKey = process.env.BACKUP_ENCRYPTION_KEY, expectedCurrentVersion = null } = {}) {
  if (!databaseUrl) throw new Error("DATABASE_URL is required.");
  const snapshot = await inspectRecoverySnapshot({ source, encryptionKey });
  const repo = createPostgresRepository(databaseUrl);
  try {
    await repo.migrate();
    const current = await repo.loadState();
    if (!current) {
      const seeded = await repo.seedIfEmpty(snapshot.payload);
      return { restored: true, version: seeded.state.version, sourceVersion: snapshot.sourceVersion, payloadChecksum: snapshot.payloadChecksum };
    }
    if (expectedCurrentVersion !== null && Number(expectedCurrentVersion) !== Number(current.version)) throw new Error(`Recovery precondition failed: expected current version ${expectedCurrentVersion}, found ${current.version}.`);
    const saved = await repo.saveState(snapshot.payload, {
      expectedVersion: current.version,
      outbox: [{ topic: "system.recovery-restored", aggregateType: "system", aggregateId: "primary", payload: { sourceVersion: snapshot.sourceVersion, restoredAt: new Date().toISOString() } }],
    });
    await repo.appendAudit({ actorId: "system", action: "recovery.restore", entityType: "system", entityId: "primary", detail: { sourceVersion: snapshot.sourceVersion, restoredVersion: saved.version, checksum: snapshot.payloadChecksum } });
    return { restored: true, version: saved.version, sourceVersion: snapshot.sourceVersion, payloadChecksum: snapshot.payloadChecksum };
  } finally {
    await repo.close();
  }
}
