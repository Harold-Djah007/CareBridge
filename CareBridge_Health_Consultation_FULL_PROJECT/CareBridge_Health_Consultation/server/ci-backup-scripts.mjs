import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

// Exercise the scripts with a fake Docker executable; never touch a real database.
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "carebridge-backup-check-"));
const deploy = path.join(directory, "deploy");
const bin = path.join(directory, "bin");
const log = path.join(directory, "calls.log");
try {
  fs.mkdirSync(deploy);
  fs.mkdirSync(bin);
  for (const name of ["backup-postgres.sh", "restore-postgres.sh"]) fs.copyFileSync(new URL(`../deploy/${name}`, import.meta.url), path.join(deploy, name));
  fs.writeFileSync(path.join(bin, "docker"), `#!/bin/sh
set -eu
printf '%s\\n' "$*" >> "$BACKUP_TEST_LOG"
for arg do last=$arg; done
case "$*" in
  *" cp postgres:"*) printf 'fixture archive' > "$last" ;;
  *"pg_restore --list"*) [ "\${BACKUP_TEST_INVALID:-}" != "true" ] ;;
esac
`, { mode: 0o700 });
  const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, BACKUP_TEST_LOG: log, CAREBRIDGE_CONFIRM_RESTORE: "YES" };
  const run = (name, args = [], extra = {}) => spawnSync("sh", [path.join(deploy, name), ...args], { cwd: directory, env: { ...env, ...extra }, encoding: "utf8" });
  const backup = run("backup-postgres.sh");
  assert.equal(backup.status, 0, backup.stderr);
  const file = fs.readdirSync(path.join(directory, "backups")).find((name) => name.endsWith(".dump"));
  const source = path.join(directory, "backups", file);
  fs.writeFileSync(log, "");
  const restore = run("restore-postgres.sh", [source]);
  assert.equal(restore.status, 0, restore.stderr);
  const calls = fs.readFileSync(log, "utf8");
  assert.ok(calls.indexOf("pg_restore --list") < calls.indexOf("stop app"));
  for (const extra of [{ BACKUP_TEST_INVALID: "true" }, { CAREBRIDGE_CONFIRM_RESTORE: "NO" }]) {
    fs.writeFileSync(log, "");
    assert.notEqual(run("restore-postgres.sh", [source], extra).status, 0);
    assert.ok(!fs.readFileSync(log, "utf8").includes("stop app"));
  }
  fs.writeFileSync(source, "corrupted archive");
  fs.writeFileSync(log, "");
  assert.notEqual(run("restore-postgres.sh", [source]).status, 0);
  assert.equal(fs.readFileSync(log, "utf8"), "");
  fs.rmSync(`${source}.sha256`);
  assert.notEqual(run("restore-postgres.sh", [source]).status, 0);
  assert.equal(fs.readFileSync(log, "utf8"), "");
  console.log("✓ portable backup checksum; checksum/archive/confirmation failures never stop the app or replace records");
} finally {
  fs.rmSync(directory, { recursive: true, force: true });
}
