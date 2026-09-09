import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], { cwd: appRoot, encoding: "utf8" }).trim();
const tracked = execFileSync("git", ["ls-files", "-z"], { cwd: repoRoot, encoding: "utf8" }).split("\0").filter(Boolean);
const relativeApp = path.relative(repoRoot, appRoot).replace(/\\/g, "/");
const appFiles = tracked.filter((file) => file === relativeApp || file.startsWith(`${relativeApp}/`));
const local = (repoFile) => path.join(repoRoot, repoFile);
const rel = (name) => `${relativeApp}/${name}`;
const errors = [];

function requireFile(name) {
  const file = rel(name);
  if (!appFiles.includes(file) || !fs.existsSync(local(file))) errors.push(`Required release file is missing: ${name}`);
}

for (const name of [
  ".dockerignore",
  "Dockerfile",
  "docker-compose.production.yml",
  "deploy/Caddyfile",
  "deploy/.env.production.example",
  "deploy/backup-postgres.sh",
  "deploy/backup-postgres.ps1",
  "deploy/restore-postgres.sh",
  "deploy/restore-postgres.ps1",
  "server/.env.example",
  "server/productionConfig.js",
  "server/ci-production-release.mjs",
  "scripts/postdeploy-smoke.mjs",
  "PRODUCTION_RELEASE.md",
]) requireFile(name);

const dangerousPath = (file) => {
  const base = path.basename(file);
  if (base === ".env.example" || base === ".env.production.example") return false;
  if (base === ".env" || base.startsWith(".env.")) return true;
  return /\.(?:pem|key|p12|pfx)$/i.test(base);
};
for (const file of appFiles.filter(dangerousPath)) errors.push(`Potential secret file is tracked: ${file}`);

const textExtensions = new Set([".js", ".jsx", ".mjs", ".json", ".yml", ".yaml", ".md", ".sh", ".ps1", ".txt", ".conf"]);
for (const file of appFiles) {
  const full = local(file);
  if (!fs.existsSync(full) || fs.statSync(full).size > 2_000_000) continue;
  const base = path.basename(file);
  if (!textExtensions.has(path.extname(file).toLowerCase()) && !["Dockerfile", "Caddyfile", ".gitignore", ".dockerignore"].includes(base)) continue;
  const source = fs.readFileSync(full, "utf8");
  if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(source)) errors.push(`Private key material found in tracked file: ${file}`);
  if (/\bgh[pousr]_[A-Za-z0-9]{30,}\b/.test(source)) errors.push(`GitHub token-like value found in tracked file: ${file}`);
  if (/\bAKIA[0-9A-Z]{16}\b/.test(source)) errors.push(`AWS access-key-like value found in tracked file: ${file}`);
}

function content(name) {
  const full = path.join(appRoot, name);
  return fs.existsSync(full) ? fs.readFileSync(full, "utf8") : "";
}

const envTemplate = content("server/.env.example");
for (const key of [
  "PERSISTENCE_PROVIDER", "DATABASE_URL", "REDIS_URL", "REDIS_SESSION_ENFORCE", "MFA_ENCRYPTION_KEY",
  "BACKUP_ENCRYPTION_KEY", "FLW_SECRET_KEY", "FLW_SECRET_HASH", "SMTP_HOST", "SMTP_USER", "SMTP_PASS",
  "CLIENT_URL", "APP_URL", "SESSION_DAYS", "SESSION_MAX_PER_USER", "PASSWORD_MIN_LENGTH",
]) {
  if (!new RegExp(`^${key}=`, "m").test(envTemplate)) errors.push(`server/.env.example does not document ${key}.`);
}

const gitignore = content(".gitignore");
for (const entry of ["server/.env", "deploy/.env.production", "backups/", "*.pem", "*.key"]) {
  if (!gitignore.includes(entry)) errors.push(`.gitignore is missing release-safety rule: ${entry}`);
}

const dockerignore = content(".dockerignore");
for (const entry of ["server/.env", "deploy/.env.production", "backups", "*.pem", "*.key", "**/node_modules"]) {
  if (!dockerignore.includes(entry)) errors.push(`.dockerignore is missing build-context safety rule: ${entry}`);
}

const compose = content("docker-compose.production.yml");
for (const needle of ["postgres:17-alpine", "redis:7-alpine", "PERSISTENCE_PROVIDER: postgres", "REDIS_SESSION_ENFORCE: \"true\"", "no-new-privileges:true"]) {
  if (!compose.includes(needle)) errors.push(`Production compose contract is missing: ${needle}`);
}

const dockerfile = content("Dockerfile");
for (const needle of ["FROM node:22-alpine", "USER node", "HEALTHCHECK", "npm run build --prefix client"]) {
  if (!dockerfile.includes(needle)) errors.push(`Production Dockerfile contract is missing: ${needle}`);
}

const workflowPath = path.join(repoRoot, ".github", "workflows", "carebridge-ci.yml");
const workflow = fs.existsSync(workflowPath) ? fs.readFileSync(workflowPath, "utf8") : "";
for (const needle of ["Client performance budget", "PostgreSQL primary runtime restart regression", "Encrypted PostgreSQL disaster-recovery drill", "Browser UX quality regression across desktop and mobile", "Production-mode release certification", "Repository release hygiene audit", "Build hardened production container"]) {
  if (!workflow.includes(needle)) errors.push(`CI release gate is missing: ${needle}`);
}

if (errors.length) {
  console.error("CareBridge release hygiene audit failed:\n");
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log(`✓ ${appFiles.length} tracked CareBridge files checked for release hygiene`);
console.log("✓ production deployment, recovery, environment and CI contracts present");
console.log("✓ Git and Docker contexts exclude production secrets, keys and backups");
console.log("CareBridge repository release hygiene audit passed.");
