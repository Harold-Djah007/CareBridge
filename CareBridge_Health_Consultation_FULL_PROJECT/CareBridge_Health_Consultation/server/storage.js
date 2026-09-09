import fs from "fs";
import path from "path";

function parseJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

export function createJsonStore(dataFile) {
  const resolved = path.resolve(dataFile);
  const backup = `${resolved}.backup`;
  let writes = 0;
  let recoveries = 0;
  let lastWriteAt = null;

  const read = () => {
    try {
      const db = parseJson(resolved);
      if (!db || typeof db !== "object" || Array.isArray(db)) throw new Error("CareBridge datastore root must be an object.");
      return db;
    } catch (error) {
      if (!fs.existsSync(backup)) throw error;
      const db = parseJson(backup);
      recoveries += 1;
      return db;
    }
  };

  const write = (db) => {
    if (!db || typeof db !== "object" || Array.isArray(db)) throw new Error("Refusing to persist an invalid CareBridge datastore.");
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    const temp = `${resolved}.${process.pid}.${Date.now()}.tmp`;
    const payload = `${JSON.stringify(db, null, 2)}\n`;

    if (fs.existsSync(resolved)) fs.copyFileSync(resolved, backup);
    const fd = fs.openSync(temp, "w", 0o600);
    try {
      fs.writeFileSync(fd, payload, "utf8");
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    fs.renameSync(temp, resolved);
    writes += 1;
    lastWriteAt = new Date().toISOString();
  };

  const status = () => ({
    engine: "atomic-json",
    file: path.basename(resolved),
    backupAvailable: fs.existsSync(backup),
    writes,
    recoveries,
    lastWriteAt,
  });

  return { read, write, status };
}
