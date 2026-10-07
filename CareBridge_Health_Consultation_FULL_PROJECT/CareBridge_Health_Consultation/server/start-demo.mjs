import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

if (process.env.NODE_ENV === "production") throw new Error("The demo launcher cannot run in production mode.");
const here = path.dirname(fileURLToPath(import.meta.url));
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "carebridge-demo-"));
process.env.NODE_ENV = "demo";
process.env.DATA_FILE = path.join(directory, "db.json");
process.env.PERSISTENCE_PROVIDER = "json";
process.env.CAREBRIDGE_DEMO = "true";
process.env.MFA_ENCRYPTION_KEY = crypto.randomBytes(32).toString("hex");
process.env.BACKUP_ENCRYPTION_KEY = crypto.randomBytes(32).toString("hex");
for (const key of ["DATABASE_URL", "REDIS_URL", "FLW_SECRET_KEY", "FLW_SECRET_HASH", "SMTP_HOST", "SMTP_USER", "SMTP_PASS", "CAREBRIDGE_TURN_URLS", "CAREBRIDGE_TURN_SECRET"]) process.env[key] = "";
if (process.env.RENDER_EXTERNAL_URL) {
  process.env.APP_URL = process.env.RENDER_EXTERNAL_URL;
  process.env.CLIENT_URL = process.env.RENDER_EXTERNAL_URL;
  process.env.CLIENT_URLS = process.env.RENDER_EXTERNAL_URL;
  process.env.CAREBRIDGE_BEHIND_TLS_PROXY = "true";
}
const fixture = JSON.parse(fs.readFileSync(path.join(here, "tests", "fixtures", "demo.json"), "utf8"));
fixture.sessions = [];
fs.writeFileSync(process.env.DATA_FILE, JSON.stringify(fixture), { mode: 0o600 });
console.log("CareBridge public demo: sample data resets on every restart; live payments and email are disabled.");
await import("./index.js");
