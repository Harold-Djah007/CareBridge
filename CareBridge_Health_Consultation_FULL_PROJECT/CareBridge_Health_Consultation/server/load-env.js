import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { assertProductionConfiguration } from "./productionConfig.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(here, ".env");
if (fs.existsSync(envPath)) {
  const source = fs.readFileSync(envPath, "utf8");
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index < 1) continue;
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

if (process.env.NODE_ENV === "production") {
  assertProductionConfiguration(process.env);
}
