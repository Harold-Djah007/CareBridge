import { hashPassword, validatePassword } from "./auth.js";
import { newId } from "./ids.js";

// Only bootstrap a brand-new empty database. Never reset an existing account.
export async function ensureBootstrapAdmin(store, env = process.env) {
  const db = store.read();
  if (db.users?.length) return false;
  const email = String(env.CAREBRIDGE_BOOTSTRAP_ADMIN_EMAIL || "").trim().toLowerCase();
  const password = env.CAREBRIDGE_BOOTSTRAP_ADMIN_PASSWORD;
  if (!email && !password && env.NODE_ENV !== "production") return false;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !validatePassword(password).ok) {
    throw new Error("An empty deployment requires CAREBRIDGE_BOOTSTRAP_ADMIN_EMAIL and a strong CAREBRIDGE_BOOTSTRAP_ADMIN_PASSWORD.");
  }
  db.users = [{ id: newId("u"), role: "admin", status: "active", name: "CareBridge Administrator", email, password: hashPassword(password), createdAt: new Date().toISOString() }];
  await store.write(db);
  await store.flush();
  return true;
}
