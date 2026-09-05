import { isSellable, onShelf } from "./pharmacy.js";
import { tariffOf } from "./finance.js";

export const stockShortage = (n) => ({
  message: `Only ${Number(n) || 0} units are currently available.`,
  available: Number(n) || 0,
});

export function ensureCarts(db) {
  if (!Array.isArray(db.carts)) {
    db.carts = [];
    return true;
  }
  return false;
}

function nid() {
  return `ci${Date.now()}${Math.floor(Math.random() * 900)}`;
}

function actorOf(db, req) {
  const userId = req.body?.userId || req.body?.actorId || req.body?.patientId || req.query.userId;
  const user = (db.users || []).find((u) => u.id === userId);
  if (!user) return { error: "Patient is required.", status: 400 };
  if (user.role !== "patient") return { error: "Only signed-in patients can use the hospital shop.", status: 403 };
  return { user };
}

function kindOf(value) {
  if (value === "service") return "svc";
  return value || "svc";
}

function productIdOf(row = {}) {
  return String(row.productId || row.id || "").trim();
}

export function getOrCreateCart(db, userId) {
  ensureCarts(db);
  let cart = db.carts.find((c) => c.userId === userId);
  if (!cart) {
    cart = { id: `cart-${userId}`, userId, items: [], updatedAt: new Date().toISOString() };
    db.carts.push(cart);
  }
  if (!Array.isArray(cart.items)) cart.items = [];
  return cart;
}

export function resolveCatalogItem(db, kind, productId, userId) {
  const k = kindOf(kind);
  if (!productId) return { error: "Choose an item from the hospital catalog.", status: 400 };

  if (k === "med") {
    const product = (db.pharmacyStock || []).find((p) => p.id === productId);
    if (!product || !onShelf(product)) return { error: "That medicine is not on the shelf.", status: 400 };
    const available = Math.max(0, Number(product.qty || 0));
    return {
      kind: "med",
      product,
      id: product.id,
      name: product.name,
      price: Number(product.price || 0),
      available,
      max: available,
      sellable: isSellable(product),
    };
  }

  if (k === "lab") {
    const product = (tariffOf(db).labs || []).find((p) => p.id === productId);
    if (!product) return { error: "That laboratory test is not on the tariff.", status: 400 };
    return {
      kind: "lab",
      product,
      id: product.id,
      name: product.name,
      price: Number(product.price || 0),
      available: 99,
      max: 99,
      sellable: true,
    };
  }

  if (k === "svc") {
    const product = (tariffOf(db).services || []).find((p) => p.id === productId);
    if (!product) return { error: "That hospital service is not on the tariff.", status: 400 };
    return {
      kind: "svc",
      product,
      id: product.id,
      name: product.name,
      price: Number(product.price || 0),
      available: 99,
      max: 99,
      sellable: true,
    };
  }

  if (k === "invoice") {
    const product = (db.invoices || []).find((i) => i.id === productId);
    if (!product) return { error: "Invoice not found.", status: 404 };
    if (userId && product.patientId !== userId) return { error: "That bill is not on your file.", status: 403 };
    if (product.status !== "due") return { error: "That bill is already settled.", status: 400 };
    return {
      kind: "invoice",
      product,
      id: product.id,
      name: product.item,
      price: Number(product.amount || 0),
      available: 1,
      max: 1,
      sellable: true,
    };
  }

  return { error: "Unknown cart item.", status: 400 };
}

function persistLine(row) {
  return {
    itemId: row.itemId,
    kind: row.kind,
    productId: row.productId,
    id: row.productId,
    qty: row.qty,
    unitPrice: row.unitPrice,
  };
}

export function hydrateCartItem(db, item, userId) {
  const kind = kindOf(item.kind);
  const productId = productIdOf(item);
  const resolved = resolveCatalogItem(db, kind, productId, userId);
  if (resolved.error) return null;
  if (kind === "med" && (!resolved.sellable || resolved.available <= 0)) return null;
  const qty = kind === "invoice"
    ? 1
    : Math.max(1, Math.min(Number(item.qty || 1) || 1, resolved.max || 99));
  const price = resolved.price;
  return {
    itemId: item.itemId || `ci-${kind}-${productId}`,
    kind,
    productId,
    id: productId,
    qty,
    unitPrice: price,
    price,
    name: resolved.name,
    item: resolved.name,
    amount: kind === "invoice" ? price : price * qty,
    max: resolved.max,
    pack: resolved.product.pack || resolved.product.specimen || "",
    category: resolved.product.category || (kind === "lab" ? "Laboratory" : kind === "svc" ? "Service" : ""),
    nhis: Boolean(resolved.product.nhis),
    date: resolved.product.date || "",
    patientId: resolved.product.patientId || userId,
  };
}

export function cartPayload(db, cart, userId) {
  const items = (cart.items || []).map((row) => hydrateCartItem(db, row, userId || cart.userId)).filter(Boolean);
  cart.items = items.map(persistLine);
  cart.updatedAt = new Date().toISOString();
  const total = items.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const count = items.reduce((sum, row) => sum + Number(row.qty || 0), 0);
  return { id: cart.id, userId: cart.userId, items, count, subtotal: total, total, updatedAt: cart.updatedAt };
}

export function clearUserCart(db, userId) {
  if (!userId) return false;
  const cart = (db.carts || []).find((c) => c.userId === userId);
  if (!cart || !cart.items?.length) return false;
  cart.items = [];
  cart.updatedAt = new Date().toISOString();
  return true;
}

export function removeCartKinds(db, userId, kinds = []) {
  if (!userId) return false;
  const cart = (db.carts || []).find((c) => c.userId === userId);
  if (!cart) return false;
  const drop = new Set(kinds);
  const next = (cart.items || []).filter((row) => !drop.has(kindOf(row.kind)));
  if (next.length === (cart.items || []).length) return false;
  cart.items = next;
  cart.updatedAt = new Date().toISOString();
  return true;
}

function findLine(cart, itemId) {
  const key = decodeURIComponent(String(itemId || ""));
  return cart.items.find((row) => (
    row.itemId === key
    || row.productId === key
    || row.id === key
    || `${row.kind}:${row.productId}` === key
    || `${row.kind}:${row.id}` === key
  ));
}

function upsertLine(db, cart, userId, input) {
  const kind = kindOf(input.kind);
  const productId = productIdOf(input);
  const resolved = resolveCatalogItem(db, kind, productId, userId);
  if (resolved.error) return resolved;
  const requested = kind === "invoice" ? 1 : Math.max(1, Number(input.qty || 1) || 1);
  const existing = cart.items.find((row) => kindOf(row.kind) === kind && productIdOf(row) === productId);
  const nextQty = input.replace || kind === "invoice"
    ? requested
    : requested + Number(existing?.qty || 0);
  if (kind === "med") {
    if (!resolved.sellable || resolved.available <= 0) {
      return { ...stockShortage(0), status: 409 };
    }
    if (nextQty > resolved.available) {
      return { ...stockShortage(resolved.available), status: 409 };
    }
  }
  const line = persistLine({
    itemId: existing?.itemId || input.itemId || nid(),
    kind,
    productId,
    qty: kind === "invoice" ? 1 : nextQty,
    unitPrice: resolved.price,
  });
  if (existing) Object.assign(existing, line);
  else cart.items.push(line);
  return { line };
}

function replaceCartItems(db, cart, userId, items) {
  const next = [];
  for (const input of items || []) {
    const kind = kindOf(input.kind);
    const productId = productIdOf(input);
    const resolved = resolveCatalogItem(db, kind, productId, userId);
    if (resolved.error) return resolved;
    const qty = kind === "invoice" ? 1 : Math.max(1, Number(input.qty || 1) || 1);
    if (kind === "med") {
      if (!resolved.sellable || resolved.available <= 0) return { ...stockShortage(0), status: 409 };
      if (qty > resolved.available) return { ...stockShortage(resolved.available), status: 409 };
    }
    const prev = (cart.items || []).find((row) => kindOf(row.kind) === kind && productIdOf(row) === productId);
    if (next.some((row) => row.kind === kind && row.productId === productId)) continue;
    next.push(persistLine({
      itemId: input.itemId || prev?.itemId || nid(),
      kind,
      productId,
      qty,
      unitPrice: resolved.price,
    }));
  }
  cart.items = next;
  return { ok: true };
}

export function mountCart(app, { readDb, writeDb }) {
  const loadShopper = (req, res) => {
    const db = readDb();
    const actor = actorOf(db, req);
    if (actor.error) {
      res.status(actor.status).json({ message: actor.error });
      return { db: null, user: null };
    }
    return { db, user: actor.user, cart: getOrCreateCart(db, actor.user.id) };
  };

  app.get("/api/cart", (req, res) => {
    const ctx = loadShopper(req, res);
    if (!ctx.user) return;
    const payload = cartPayload(ctx.db, ctx.cart, ctx.user.id);
    writeDb(ctx.db);
    res.json(payload);
  });

  const writeItems = (req, res, replace) => {
    const ctx = loadShopper(req, res);
    if (!ctx.user) return;
    const batch = Array.isArray(req.body.items) ? req.body.items : [req.body];
    if (replace) {
      const result = replaceCartItems(ctx.db, ctx.cart, ctx.user.id, batch);
      if (result.error || result.message) {
        return res.status(result.status || 400).json({ message: result.error || result.message, available: result.available });
      }
    } else {
      for (const input of batch) {
        if (!productIdOf(input) && !input.kind) continue;
        const result = upsertLine(ctx.db, ctx.cart, ctx.user.id, { ...input, replace: Boolean(req.body.replace) });
        if (result.error || result.message) {
          return res.status(result.status || 400).json({ message: result.error || result.message, available: result.available });
        }
      }
    }
    ctx.cart.updatedAt = new Date().toISOString();
    writeDb(ctx.db);
    res.status(replace ? 200 : 201).json(cartPayload(ctx.db, ctx.cart, ctx.user.id));
  };

  app.post("/api/cart/items", (req, res) => writeItems(req, res, false));
  app.put("/api/cart", (req, res) => writeItems(req, res, true));

  app.patch("/api/cart/items/:itemId", (req, res) => {
    const ctx = loadShopper(req, res);
    if (!ctx.user) return;
    const line = findLine(ctx.cart, req.params.itemId);
    if (!line) return res.status(404).json({ message: "That item is not in your cart." });
    const qty = Number(req.body.qty);
    if (!Number.isFinite(qty) || qty < 0) return res.status(400).json({ message: "Quantity is required." });
    if (qty === 0) {
      ctx.cart.items = ctx.cart.items.filter((row) => row !== line);
    } else {
      const resolved = resolveCatalogItem(ctx.db, line.kind, productIdOf(line), ctx.user.id);
      if (resolved.error) return res.status(resolved.status || 400).json({ message: resolved.error });
      if (line.kind === "med" && qty > resolved.available) {
        return res.status(409).json(stockShortage(resolved.available));
      }
      line.qty = line.kind === "invoice" ? 1 : qty;
      line.unitPrice = resolved.price;
    }
    ctx.cart.updatedAt = new Date().toISOString();
    writeDb(ctx.db);
    res.json(cartPayload(ctx.db, ctx.cart, ctx.user.id));
  });

  app.delete("/api/cart/items/:itemId", (req, res) => {
    const ctx = loadShopper(req, res);
    if (!ctx.user) return;
    const line = findLine(ctx.cart, req.params.itemId);
    if (!line) return res.status(404).json({ message: "That item is not in your cart." });
    ctx.cart.items = ctx.cart.items.filter((row) => row !== line);
    ctx.cart.updatedAt = new Date().toISOString();
    writeDb(ctx.db);
    res.json(cartPayload(ctx.db, ctx.cart, ctx.user.id));
  });

  app.delete("/api/cart", (req, res) => {
    const ctx = loadShopper(req, res);
    if (!ctx.user) return;
    ctx.cart.items = [];
    ctx.cart.updatedAt = new Date().toISOString();
    writeDb(ctx.db);
    res.json(cartPayload(ctx.db, ctx.cart, ctx.user.id));
  });
}
