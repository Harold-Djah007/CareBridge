import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temporaryRoot = path.resolve(os.tmpdir());
const directory = fs.mkdtempSync(path.join(temporaryRoot, "carebridge-regressions-"));
const suites = ["ci-quality-regression", "ci-role-regression", "ci-security-regression", "ci-load-slo-regression", "ci-integration-regression", "ci-bootstrap-regression"];
let active;
const stop = () => active?.kill();
process.on("exit", stop);
try {
  for (const [index, suite] of suites.entries()) {
    const fixture = path.join(directory, `${suite}.json`);
    fs.copyFileSync(path.join(root, "server", "tests", "fixtures", "demo.json"), fixture);
    const code = await new Promise((resolve, reject) => {
      active = spawn(process.execPath, [path.join("server", `${suite}.mjs`)], {
        cwd: root,
        stdio: "inherit",
        env: { ...process.env, NODE_ENV: "development", PERSISTENCE_PROVIDER: "atomic-json", DATABASE_URL: "", REDIS_URL: "", DATA_FILE: fixture, LOG_LEVEL: "silent", PORT: String(5070 + index) },
      });
      active.once("error", reject);
      active.once("exit", (exitCode) => { active = null; resolve(exitCode ?? 1); });
    });
    if (code !== 0) { process.exitCode = code; break; }
  }
} finally {
  process.removeListener("exit", stop);
  // Only remove the unique directory created above, within the OS temporary root.
  if (path.dirname(path.resolve(directory)) === temporaryRoot) fs.rmSync(directory, { recursive: true, force: true });
}
