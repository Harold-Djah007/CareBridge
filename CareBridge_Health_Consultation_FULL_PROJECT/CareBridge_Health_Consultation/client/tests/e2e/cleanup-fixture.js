import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export default async function cleanupFixture() {
  const directory = process.env.CAREBRIDGE_E2E_TEMP_DIRECTORY;
  if (!directory) return;
  const resolved = path.resolve(directory);
  if (path.dirname(resolved) !== path.resolve(os.tmpdir()) || !path.basename(resolved).startsWith("carebridge-browser-")) {
    throw new Error("Refusing to remove a browser fixture outside the managed temporary directory.");
  }
  fs.rmSync(resolved, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
