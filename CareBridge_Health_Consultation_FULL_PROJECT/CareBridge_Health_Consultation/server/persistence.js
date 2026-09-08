import crypto from "crypto";
import fs from "fs";
import path from "path";

const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");

function ensureParent(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
}

function fsyncFile(file) {
  const fd = fs.openSync(file, "r");
  try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}

function fsyncDir(dir) {
  try {
    const fd = fs.openSync(dir, "r");
    try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  } catch {
    // Directory fsync is not supported on every platform/filesystem.
  }
}

export function createDurableJsonStore(file, { backups = 3 } = {}) {
  const dataFile = path.resolve(file);
  const checksumFile = `${dataFile}.sha256`;
  const journalFile = `${dataFile}.journal.ndjson`;
  let writes = 0;
  let recoveries = 0;
  let lastWriteAt = null;

  ensureParent(dataFile);

  const backupPath = (index) => `${dataFile}.bak${index}`;

  function rotateBackups() {
    for (let i = backups; i >= 2; i -= 1) {
      const from = backupPath(i - 1);
      const to = backupPath(i);
      if (fs.existsSync(from)) fs.copyFileSync(from, to);
    }
    if (fs.existsSync(dataFile)) fs.copyFileSync(dataFile, backupPath(1));
  }

  function parseFile(candidate) {
    const raw = fs.readFileSync(candidate, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("CareBridge data root must be an object.");
    return { parsed, raw };
  }

  function recover() {
    for (let i = 1; i <= backups; i += 1) {
      const candidate = backupPath(i);
      if (!fs.existsSync(candidate)) continue;
      try {
        const { parsed, raw } = parseFile(candidate);
        const temp = `${dataFile}.recover-${process.pid}-${Date.now()}`;
        fs.writeFileSync(temp, raw, { encoding: "utf8", mode: 0o600 });
        fsyncFile(temp);
        fs.renameSync(temp, dataFile);
        fs.writeFileSync(checksumFile, `${sha256(raw)}\n`, { encoding: "utf8", mode: 0o600 });
        recoveries += 1;
        return parsed;
      } catch {
        // Try the next retained backup.
      }
    }
    return null;
  }

  function read() {
    try {
      return parseFile(dataFile).parsed;
    } catch (error) {
      const restored = recover();
      if (restored) return restored;
      const wrapped = new Error(`CareBridge data store could not be read or recovered: ${error.message}`);
      wrapped.cause = error;
      throw wrapped;
    }
  }

  function write(db) {
    const raw = `${JSON.stringify(db, null, 2)}\n`;
    const digest = sha256(raw);
    const dir = path.dirname(dataFile);
    const temp = `${dataFile}.tmp-${process.pid}-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;

    ensureParent(dataFile);
    rotateBackups();
    fs.writeFileSync(temp, raw, { encoding: "utf8", mode: 0o600 });
    fsyncFile(temp);
    fs.renameSync(temp, dataFile);
    fsyncDir(dir);
    fs.writeFileSync(checksumFile, `${digest}\n`, { encoding: "utf8", mode: 0o600 });
    fs.appendFileSync(journalFile, `${JSON.stringify({ at: new Date().toISOString(), sha256: digest, bytes: Buffer.byteLength(raw), pid: process.pid })}\n`, { encoding: "utf8", mode: 0o600 });
    writes += 1;
    lastWriteAt = new Date().toISOString();
    return db;
  }

  function health() {
    let readable = false;
    let checksumValid = null;
    let bytes = 0;
    let error = "";
    try {
      const { raw } = parseFile(dataFile);
      readable = true;
      bytes = Buffer.byteLength(raw);
      if (fs.existsSync(checksumFile)) {
        const expected = fs.readFileSync(checksumFile, "utf8").trim();
        checksumValid = expected ? expected === sha256(raw) : null;
      }
    } catch (caught) {
      error = caught.message;
    }
    return {
      provider: "atomic-json",
      durableWrite: "temp+fsync+rename",
      readable,
      checksumValid,
      backups: Array.from({ length: backups }, (_, index) => fs.existsSync(backupPath(index + 1))).filter(Boolean).length,
      journal: fs.existsSync(journalFile),
      bytes,
      writes,
      recoveries,
      lastWriteAt,
      error,
    };
  }

  return { read, write, health, path: dataFile };
}
