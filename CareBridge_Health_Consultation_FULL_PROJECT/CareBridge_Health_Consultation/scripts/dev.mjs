import concurrently from "concurrently";
import { fileURLToPath } from "node:url";
import { availablePort } from "./dev-port.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const port = await availablePort(Number(process.env.PORT || 5000), process.env.PORT ? 1 : 20);
const env = { ...process.env, PORT: String(port), CAREBRIDGE_API_PORT: String(port) };
console.log(`CareBridge API: http://localhost:${port}. Use the frontend URL printed by Vite below.`);
const { result } = concurrently([
  { command: "npm run dev --prefix server", name: "api", env },
  { command: "npm run dev --prefix client", name: "web", env },
], { cwd: root, killOthers: ["failure", "success"] });
try { await result; } catch { process.exitCode = 1; }
