import assert from "node:assert/strict";
import { verifyTurn } from "../scripts/integration-checks.mjs";

if (!process.env.CAREBRIDGE_TURN_URLS || !process.env.CAREBRIDGE_TURN_SECRET) throw new Error("An isolated Coturn fixture is required.");
for (const transport of ["udp", "tcp"]) {
  const urls = process.env.CAREBRIDGE_TURN_URLS.replace(/\?transport=(udp|tcp)/g, "") + `?transport=${transport}`;
  const result = await verifyTurn({ ...process.env, CAREBRIDGE_TURN_URLS: urls });
  assert.deepEqual(result, { relay: true, dataEcho: true });
  console.log(`✓ real Coturn ${transport} relay: expiring credentials, selected relay candidates and bidirectional data exchange`);
}
await assert.rejects(() => verifyTurn({ ...process.env, CAREBRIDGE_TURN_SECRET: "incorrect-relay-secret-for-negative-test" }));
console.log("✓ invalid relay credentials cannot fall back to a direct connection");
