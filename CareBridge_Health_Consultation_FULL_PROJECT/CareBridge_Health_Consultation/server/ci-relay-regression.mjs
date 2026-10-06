import assert from "node:assert/strict";
import net from "node:net";
import { verifyTurn } from "../scripts/integration-checks.mjs";

if (!process.env.CAREBRIDGE_TURN_URLS || !process.env.CAREBRIDGE_TURN_SECRET) throw new Error("An isolated Coturn fixture is required.");
const fixture = new URL(process.env.CAREBRIDGE_TURN_URLS.replace(/^turn:/, "http://"));
let listening = false;
for (let attempt = 0; attempt < 50 && !listening; attempt++) {
  listening = await new Promise((resolve) => {
    const socket = net.createConnection({ host: fixture.hostname, port: Number(fixture.port || 3478) });
    const finish = (ok) => { socket.destroy(); resolve(ok); };
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
    socket.setTimeout(1000, () => finish(false));
  });
  if (!listening) await new Promise((resolve) => setTimeout(resolve, 200));
}
assert.ok(listening, "Coturn fixture did not become ready");
for (const transport of ["udp", "tcp"]) {
  const urls = process.env.CAREBRIDGE_TURN_URLS.replace(/\?transport=(udp|tcp)/g, "") + `?transport=${transport}`;
  const result = await verifyTurn({ ...process.env, CAREBRIDGE_TURN_URLS: urls });
  assert.deepEqual(result, { relay: true, dataEcho: true });
  console.log(`✓ real Coturn ${transport} relay: expiring credentials, selected relay candidates and bidirectional data exchange`);
}
await assert.rejects(() => verifyTurn({ ...process.env, CAREBRIDGE_TURN_SECRET: "incorrect-relay-secret-for-negative-test" }));
console.log("✓ invalid relay credentials cannot fall back to a direct connection");
