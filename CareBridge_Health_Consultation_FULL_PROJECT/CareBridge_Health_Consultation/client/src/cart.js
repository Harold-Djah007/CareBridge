import { rxOrderQty } from "./utils";

export const cartKey = (id) => `carebridge-cart-${id}`;
const pharmacyKey = (id) => `carebridge-pharmacy-cart-${id}`;

function readJson(key) {
  try { return JSON.parse(sessionStorage.getItem(key)) || []; } catch { return []; }
}

function lineKind(item) {
  if (item?.kind === "service") return "svc";
  return item?.kind || "svc";
}

export function normalizeLine(item) {
  const kind = lineKind(item);
  const qty = Math.max(kind === "invoice" ? 1 : 0, Number(item.qty || (kind === "invoice" ? 1 : 0)));
  const price = Number(item.price ?? item.unit ?? (kind === "invoice" ? item.amount : 0) || 0);
  const name = item.name || item.item || "";
  return {
    ...item,
    kind,
    name,
    item: item.item || name,
    price,
    qty: kind === "invoice" ? 1 : qty,
    amount: kind === "invoice" ? Number(item.amount ?? price) : price * qty,
  };
}

function mergeLines(base, extra) {
  const next = base.map(normalizeLine);
  extra.map(normalizeLine).forEach((item) => {
    if (!item.id) return;
    const i = next.findIndex((c) => c.kind === item.kind && c.id === item.id);
    if (i < 0) {
      next.push(item);
      return;
    }
    if (item.kind === "invoice") return;
    const qty = Math.max(Number(next[i].qty || 0), Number(item.qty || 0));
    next[i] = normalizeLine({ ...next[i], ...item, qty });
  });
  return next;
}

export function loadCart(userId) {
  if (!userId) return [];
  const unified = readJson(cartKey(userId)).map(normalizeLine);
  const legacy = readJson(pharmacyKey(userId)).map(normalizeLine);
  const next = legacy.length ? mergeLines(unified, legacy) : unified;
  if (legacy.length) {
    sessionStorage.removeItem(pharmacyKey(userId));
    sessionStorage.setItem(cartKey(userId), JSON.stringify(next));
  }
  return next;
}

export function saveCart(userId, items) {
  const next = (items || []).map(normalizeLine);
  sessionStorage.setItem(cartKey(userId), JSON.stringify(next));
  sessionStorage.removeItem(pharmacyKey(userId));
  return next;
}

export function lineTotal(item) {
  const row = normalizeLine(item);
  if (row.kind === "invoice") return Number(row.amount || row.price || 0);
  return Number(row.price || 0) * Number(row.qty || 0);
}

export function cartTotal(items) {
  return (items || []).reduce((sum, item) => sum + lineTotal(item), 0);
}

export function cartCount(items) {
  return (items || []).reduce((sum, item) => sum + Number(item.qty || (item.kind === "invoice" ? 1 : 0)), 0);
}

export function invoiceLine(row, fallbackPatientId) {
  return normalizeLine({
    kind: "invoice",
    id: row.id,
    item: row.item,
    name: row.item,
    amount: row.amount,
    price: row.amount,
    date: row.date,
    qty: 1,
    patientId: row.patientId || fallbackPatientId,
  });
}

export function mergePrescription(cart, rx, stock) {
  const next = cart.map(normalizeLine);
  (rx.items || [{ drug: rx.drug, stockId: "" }]).forEach((line) => {
    const product = stock.find((s) => s.id === line.stockId)
      || stock.find((s) => s.name.toLowerCase() === String(line.drug || "").toLowerCase());
    if (!product || Number(product.qty) <= 0) return;
    const add = rxOrderQty(line, product);
    const found = next.find((c) => c.kind === "med" && c.id === product.id);
    if (found) found.qty = Math.min(Number(product.qty), Number(found.qty || 0) + add);
    else {
      next.push(normalizeLine({
        kind: "med",
        id: product.id,
        name: product.name,
        price: Number(product.price || 0),
        qty: add,
        pack: product.pack || "",
        max: Number(product.qty || 1),
        category: product.category,
        nhis: Boolean(product.nhis),
      }));
    }
  });
  return next;
}
