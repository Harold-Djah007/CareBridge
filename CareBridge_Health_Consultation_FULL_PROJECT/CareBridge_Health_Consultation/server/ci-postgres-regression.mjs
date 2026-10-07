import fs from "fs";
import { createPostgresRepository } from "./postgres.js";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const dataFile = process.env.DATA_FILE;
if (!dataFile) throw new Error("DATA_FILE is required");

const seed = JSON.parse(fs.readFileSync(dataFile, "utf8"));
const repo = createPostgresRepository(process.env.DATABASE_URL);

try {
  await repo.migrate();
  const ping = await repo.ping();
  if (!ping.ok || !ping.database) throw new Error("PostgreSQL ping failed");
  console.log(`✓ PostgreSQL connected (${ping.database}, ${ping.latencyMs}ms)`);

  const seeded = await repo.seedIfEmpty(seed);
  if (!seeded.state?.payload?.users?.length) throw new Error("PostgreSQL state seed failed");
  const initial = seeded.state;
  console.log(`✓ PostgreSQL state seeded/loaded at version ${initial.version}`);

  const nextPayload = structuredClone(initial.payload);
  nextPayload.__ciPostgres = { at: new Date().toISOString(), value: "transactional-write" };
  const save = await repo.saveState(nextPayload, {
    expectedVersion: initial.version,
    outbox: [{
      topic: "ci.persistence",
      aggregateType: "system",
      aggregateId: "primary",
      payload: { version: initial.version + 1 },
    }],
  });
  if (save.version !== initial.version + 1) throw new Error("PostgreSQL state version did not increment");
  const loaded = await repo.loadState();
  if (loaded.version !== save.version || loaded.payload?.__ciPostgres?.value !== "transactional-write") {
    throw new Error("PostgreSQL committed state could not be read back");
  }
  console.log("✓ transactional state write + checksum roundtrip");

  let staleRejected = false;
  try {
    await repo.saveState(nextPayload, { expectedVersion: initial.version });
  } catch (error) {
    staleRejected = error.code === "CAREBRIDGE_STALE_WRITE";
  }
  if (!staleRejected) throw new Error("Stale PostgreSQL write was not rejected");
  console.log("✓ optimistic concurrency rejects stale writes");

  const claimed = await repo.claimOutbox(10);
  const ciEvent = claimed.find((event) => event.topic === "ci.persistence");
  if (!ciEvent) throw new Error("Transactional outbox event was not claimable");
  await repo.markOutboxDelivered(ciEvent.id);
  console.log("✓ durable PostgreSQL outbox claim + delivery");

  const audit1 = await repo.appendAudit({ actorId: "ci", action: "postgres.test.start", entityType: "system", entityId: "primary", detail: { version: loaded.version } });
  const audit2 = await repo.appendAudit({ actorId: "ci", action: "postgres.test.finish", entityType: "system", entityId: "primary", detail: { ok: true } });
  if (!audit1.eventHash || audit2.previousHash !== audit1.eventHash || !audit2.eventHash) {
    throw new Error("PostgreSQL audit hash chain failed");
  }
  console.log("✓ tamper-evident PostgreSQL audit chain");

  console.log("CareBridge PostgreSQL enterprise persistence regression passed.");
} finally {
  await repo.close();
}
