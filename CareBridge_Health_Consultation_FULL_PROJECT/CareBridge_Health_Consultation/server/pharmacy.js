import { audit } from "./clinical.js";

const nid = (p) => `${p}${Date.now()}${Math.floor(Math.random() * 900)}`;

export const PHARMACY_CATEGORIES = [
  "Heart",
  "Pain & fever",
  "Infections",
  "Stomach",
  "Diabetes",
  "Respiratory",
  "Vitamins",
  "First aid",
];

export const SEED_STOCK = [
  { id: "ph1", sku: "AML-5-30", name: "Amlodipine 5 mg", pack: "30 tablets", price: 48, nhis: true, category: "Heart", qty: 42, form: "Tablet" },
  { id: "ph9", sku: "LIS-10-28", name: "Lisinopril 10 mg", pack: "28 tablets", price: 36, nhis: true, category: "Heart", qty: 18, form: "Tablet" },
  { id: "ph10", sku: "ATO-20-30", name: "Atorvastatin 20 mg", pack: "30 tablets", price: 55, nhis: true, category: "Heart", qty: 0, form: "Tablet" },
  { id: "ph11", sku: "ASA-75-28", name: "Aspirin 75 mg", pack: "28 tablets", price: 14, nhis: true, category: "Heart", qty: 64, form: "Tablet" },
  { id: "ph2", sku: "PCM-500-20", name: "Paracetamol 500 mg", pack: "20 tablets", price: 12, nhis: true, category: "Pain & fever", qty: 120, form: "Tablet" },
  { id: "ph3", sku: "IBU-400-15", name: "Ibuprofen 400 mg", pack: "15 tablets", price: 22, nhis: false, category: "Pain & fever", qty: 8, form: "Tablet" },
  { id: "ph12", sku: "DIC-50-20", name: "Diclofenac 50 mg", pack: "20 tablets", price: 28, nhis: false, category: "Pain & fever", qty: 0, form: "Tablet" },
  { id: "ph4", sku: "AMX-500-21", name: "Amoxicillin 500 mg", pack: "21 capsules", price: 35, nhis: true, category: "Infections", qty: 35, form: "Capsule" },
  { id: "ph13", sku: "AZI-500-3", name: "Azithromycin 500 mg", pack: "3 tablets", price: 32, nhis: true, category: "Infections", qty: 12, form: "Tablet" },
  { id: "ph14", sku: "CIP-500-10", name: "Ciprofloxacin 500 mg", pack: "10 tablets", price: 30, nhis: true, category: "Infections", qty: 0, form: "Tablet" },
  { id: "ph5", sku: "OMZ-20-14", name: "Omeprazole 20 mg", pack: "14 capsules", price: 40, nhis: true, category: "Stomach", qty: 24, form: "Capsule" },
  { id: "ph6", sku: "ORS-10", name: "ORS sachets", pack: "10 sachets", price: 18, nhis: true, category: "Stomach", qty: 80, form: "Sachet" },
  { id: "ph15", sku: "MET-500-56", name: "Metformin 500 mg", pack: "56 tablets", price: 28, nhis: true, category: "Diabetes", qty: 40, form: "Tablet" },
  { id: "ph7", sku: "GLU-50", name: "Glucose test strips", pack: "50 strips", price: 85, nhis: false, category: "Diabetes", qty: 15, form: "Strips" },
  { id: "ph16", sku: "SAL-100", name: "Salbutamol inhaler", pack: "100 mcg inhaler", price: 45, nhis: true, category: "Respiratory", qty: 6, form: "Inhaler" },
  { id: "ph17", sku: "CET-10-10", name: "Cetirizine 10 mg", pack: "10 tablets", price: 16, nhis: true, category: "Respiratory", qty: 0, form: "Tablet" },
  { id: "ph8", sku: "VIT-D-30", name: "Vitamin D3 1000 IU", pack: "30 tablets", price: 55, nhis: false, category: "Vitamins", qty: 22, form: "Tablet" },
  { id: "ph18", sku: "VIT-C-30", name: "Vitamin C 500 mg", pack: "30 tablets", price: 24, nhis: false, category: "Vitamins", qty: 50, form: "Tablet" },
  { id: "ph19", sku: "FOL-5-30", name: "Folic acid 5 mg", pack: "30 tablets", price: 12, nhis: true, category: "Vitamins", qty: 14, form: "Tablet" },
  { id: "ph20", sku: "PVP-100", name: "Povidone iodine 10%", pack: "100 ml", price: 22, nhis: false, category: "First aid", qty: 9, form: "Solution" },
  { id: "ph21", sku: "TAPE-1", name: "Zinc oxide tape", pack: "1 roll", price: 8, nhis: false, category: "First aid", qty: 0, form: "Dressing" },
];

export const SEED_NURSE = {
  id: "n1",
  role: "nurse",
  name: "Nurse Akosua Darko",
  email: "nurse@carebridge.test",
  password: "nurse123",
  avatar: "AD",
  photo: "",
  specialty: "Pharmacy nursing",
  department: "Ridge Campus pharmacy",
  clinic: "Outpatient pharmacy",
  employeeId: "CB-N-104",
  phone: "0245550199",
  city: "Accra",
  about: "Dispensing nurse at Ridge Campus pharmacy. Receives hospital pickup orders and keeps the medicine cupboard current.",
  status: "active",
  shift: "Day dispensary",
  emailAlerts: true,
  alertPrefs: { appointments: true, wards: true, messages: true, account: true },
};

export function onShelf(row) {
  return Boolean(row) && !row.archived && !row.hidden;
}

export function isSellable(row) {
  return onShelf(row) && row.available !== false && Number(row.qty || 0) > 0;
}

export function publicStock(row) {
  const qty = Math.max(0, Number(row.qty || 0));
  const available = onShelf(row) && row.available !== false;
  return {
    id: row.id,
    sku: row.sku || "",
    name: row.name,
    pack: row.pack || "",
    form: row.form || "",
    price: Number(row.price || 0),
    nhis: Boolean(row.nhis),
    category: row.category || "Vitamins",
    qty,
    available,
    inStock: available && qty > 0,
    archived: Boolean(row.archived),
    shelf: row.available !== false,
  };
}

export function catalogStock(rowsOrDb) {
  const rows = Array.isArray(rowsOrDb) ? rowsOrDb : (rowsOrDb?.pharmacyStock || []);
  return rows.filter(onShelf).map(publicStock);
}

export function ensurePharmacy(db) {
  let dirty = false;
  if (!Array.isArray(db.pharmacyStock)) {
    db.pharmacyStock = [];
    dirty = true;
  }
  if (!Array.isArray(db.pharmacyOrders)) {
    db.pharmacyOrders = [];
    dirty = true;
  }
  if (!db.pharmacyStock.length) {
    db.pharmacyStock = SEED_STOCK.map((row) => ({ ...row }));
    dirty = true;
  } else {
    db.pharmacyStock.forEach((row) => {
      if (!row.category) {
        const seed = SEED_STOCK.find((s) => s.id === row.id);
        row.category = seed?.category || "Vitamins";
        dirty = true;
      }
      if (row.qty === undefined) {
        row.qty = SEED_STOCK.find((s) => s.id === row.id)?.qty ?? 12;
        dirty = true;
      }
      if (row.available === undefined) {
        row.available = Number(row.qty || 0) > 0;
        dirty = true;
      }
      if (row.archived === undefined) {
        row.archived = false;
        dirty = true;
      }
    });
  }
  const hasNurse = (db.users || []).some((u) => u.id === "n1" || u.role === "nurse" || String(u.email).toLowerCase() === SEED_NURSE.email);
  if (!hasNurse) {
    db.users.push({ ...SEED_NURSE });
    dirty = true;
  }
  (db.prescriptions || []).forEach((rx) => {
    if (!Array.isArray(rx.items) || !rx.items.length) {
      rx.items = [{ stockId: "", drug: rx.drug, sig: rx.sig || "", qty: rx.qty || "" }];
      dirty = true;
    }
  });
  return dirty;
}

function nurses(db) {
  return (db.users || []).filter((u) => u.role === "nurse" && u.status !== "inactive");
}

function takeStock(db, items) {
  const lines = [];
  for (const row of items || []) {
    const product = db.pharmacyStock.find((p) => p.id === row.id || p.id === row.stockId);
    if (!product || !onShelf(product)) return { error: `Unknown medicine in the order.` };
    const qty = Math.max(1, Number(row.qty || 1));
    const available = Number(product.qty || 0);
    if (product.available === false || available < qty) {
      return { error: `${product.name} is ${product.available === false || available === 0 ? "out of stock" : `short — only ${available} left`}.` };
    }
    lines.push({
      id: product.id,
      sku: product.sku,
      name: product.name,
      pack: product.pack,
      price: Number(product.price || 0),
      nhis: Boolean(product.nhis),
      category: product.category,
      qty,
      lineTotal: Number(product.price || 0) * qty,
    });
  }
  if (!lines.length) return { error: "Choose at least one medicine that is in stock." };
  lines.forEach((line) => {
    const product = db.pharmacyStock.find((p) => p.id === line.id);
    product.qty = Number(product.qty || 0) - line.qty;
  });
  return { lines, amount: lines.reduce((s, l) => s + l.lineTotal, 0) };
}

function restoreStock(db, lines) {
  (lines || []).forEach((line) => {
    const product = db.pharmacyStock.find((p) => p.id === line.id);
    if (product) product.qty = Number(product.qty || 0) + Number(line.qty || 0);
  });
}

function enrichOrder(db, order) {
  const patient = db.users.find((u) => u.id === order.patientId) || {};
  const { password, ...safe } = patient;
  return { ...order, patient: safe };
}

export function markPharmacyPaid(db, invoices = []) {
  let changed = false;
  invoices.forEach((inv) => {
    if (!inv?.pharmacyOrderId) return;
    const order = (db.pharmacyOrders || []).find((o) => o.id === inv.pharmacyOrderId);
    if (order && order.status === "awaiting_payment") {
      order.status = "paid";
      order.paidAt = new Date().toISOString();
      changed = true;
    }
  });
  return changed;
}

export function mountPharmacy(app, ctx) {
  const { readDb, writeDb, notify, emailPatient, io, addInvoice } = ctx;

  const broadcastStock = (db) => {
    io.emit("pharmacy-stock", catalogStock(db));
  };

  const actorOrDeny = (req, res) => {
    const db = readDb();
    const actorId = req.body?.actorId || req.query.actorId;
    const actor = db.users.find((u) => u.id === actorId);
    if (!actor || !["nurse", "admin"].includes(actor.role)) {
      res.status(403).json({ message: "Only pharmacy nurses and operations can manage stock." });
      return { db: null, actor: null };
    }
    return { db, actor };
  };

  app.get("/api/pharmacy/categories", (_, res) => res.json(PHARMACY_CATEGORIES));

  app.get("/api/pharmacy/stock", (req, res) => {
    const db = readDb();
    if (String(req.query.manage) === "1") {
      return res.json((db.pharmacyStock || []).map(publicStock));
    }
    res.json(catalogStock(db));
  });

  app.post("/api/pharmacy/stock", (req, res) => {
    const db = readDb();
    const actor = db.users.find((u) => u.id === req.body.actorId);
    if (!actor || !["nurse", "admin"].includes(actor.role)) {
      return res.status(403).json({ message: "Only pharmacy nurses and operations can add stock." });
    }
    const name = String(req.body.name || "").trim();
    if (!name) return res.status(400).json({ message: "Medicine name is required." });
    const row = {
      id: nid("ph"),
      sku: String(req.body.sku || "").trim() || `SKU-${Date.now().toString().slice(-6)}`,
      name,
      pack: String(req.body.pack || "").trim() || "Pack",
      form: String(req.body.form || "").trim() || "Tablet",
      price: Math.max(0, Number(req.body.price || 0)),
      nhis: Boolean(req.body.nhis),
      category: String(req.body.category || "").trim() || "Vitamins",
      qty: Math.max(0, Number(req.body.qty || 0)),
      available: req.body.available === false ? false : Number(req.body.qty || 0) > 0,
      archived: false,
    };
    if (row.available === false) row.qty = 0;
    db.pharmacyStock.push(row);
    audit(db, { actorId: actor.id, action: "stock.create", entity: "pharmacy", entityId: row.id, detail: row.name });
    writeDb(db);
    broadcastStock(db);
    res.status(201).json(publicStock(row));
  });

  app.patch("/api/pharmacy/stock/:id", (req, res) => {
    const db = readDb();
    const actor = db.users.find((u) => u.id === req.body.actorId);
    if (!actor || !["nurse", "admin"].includes(actor.role)) {
      return res.status(403).json({ message: "Only pharmacy nurses and operations can update stock." });
    }
    const row = db.pharmacyStock.find((p) => p.id === req.params.id);
    if (!row) return res.status(404).json({ message: "That medicine is not on the shelf." });
    ["name", "sku", "pack", "form", "category"].forEach((key) => {
      if (req.body[key] !== undefined && String(req.body[key]).trim()) row[key] = String(req.body[key]).trim();
    });
    if (req.body.price !== undefined) row.price = Math.max(0, Number(req.body.price));
    if (req.body.nhis !== undefined) row.nhis = Boolean(req.body.nhis);
    if (req.body.archived !== undefined) row.archived = Boolean(req.body.archived);
    if (req.body.available !== undefined) {
      const next = Boolean(req.body.available);
      if (!next) {
        row.lastQty = Number(row.qty || 0) || row.lastQty || 0;
        row.qty = 0;
      } else if (Number(row.qty || 0) === 0 && req.body.qty === undefined) {
        row.qty = Math.max(1, Number(row.lastQty || 10));
      }
      row.available = next;
    }
    if (req.body.qty !== undefined) {
      row.qty = Math.max(0, Number(req.body.qty));
      if (req.body.available === undefined) row.available = row.qty > 0;
    }
    if (req.body.restock !== undefined) {
      const add = Math.max(0, Number(req.body.restock) || 0);
      row.qty = Number(row.qty || 0) + add;
      if (add > 0) {
        row.available = true;
        row.archived = false;
      }
    }
    if (row.archived) row.available = false;
    audit(db, { actorId: actor.id, action: "stock.update", entity: "pharmacy", entityId: row.id, detail: `${row.name} ×${row.qty}` });
    writeDb(db);
    broadcastStock(db);
    res.json(publicStock(row));
  });

  app.delete("/api/pharmacy/stock/:id", (req, res) => {
    const { db, actor } = actorOrDeny(req, res);
    if (!actor) return;
    const row = db.pharmacyStock.find((p) => p.id === req.params.id);
    if (!row) return res.status(404).json({ message: "That medicine is not on the shelf." });
    row.archived = true;
    row.available = false;
    audit(db, { actorId: actor.id, action: "stock.archive", entity: "pharmacy", entityId: row.id, detail: row.name });
    writeDb(db);
    broadcastStock(db);
    res.json({ ok: true, id: row.id });
  });

  app.get("/api/pharmacy/orders", (req, res) => {
    const db = readDb();
    const { userId, role } = req.query;
    let rows = db.pharmacyOrders || [];
    if (role === "patient") rows = rows.filter((o) => o.patientId === userId);
    res.json(rows.slice().reverse().map((o) => enrichOrder(db, o)));
  });

  app.post("/api/pharmacy/orders", async (req, res) => {
    const db = readDb();
    const patientId = req.body.patientId;
    const patient = db.users.find((u) => u.id === patientId && u.role === "patient");
    if (!patient) return res.status(400).json({ message: "Patient is required." });
    const fulfill = req.body.fulfill === "hospital" ? "hospital" : "online";
    const taken = takeStock(db, req.body.items);
    if (taken.error) return res.status(400).json({ message: taken.error });
    const order = {
      id: nid("po"),
      patientId,
      prescriptionId: req.body.prescriptionId || "",
      fulfill,
      items: taken.lines,
      amount: taken.amount,
      status: fulfill === "hospital" ? "queued" : "awaiting_payment",
      createdAt: new Date().toISOString(),
    };
    db.pharmacyOrders.push(order);
    let invoice = null;
    if (fulfill === "online") {
      invoice = addInvoice(db, {
        patientId,
        item: `Pharmacy · ${taken.lines.map((l) => `${l.name} ×${l.qty}`).join(", ")}`,
        amount: taken.amount,
        category: "pharmacy",
        lines: taken.lines,
        pharmacyOrderId: order.id,
      });
      order.invoiceId = invoice.id;
    }
    audit(db, { actorId: req.body.actorId || patientId, action: "pharmacy.order", entity: "order", entityId: order.id, detail: `${fulfill} GHS ${taken.amount}` });
    if (fulfill === "hospital") {
      nurses(db).forEach((n) => notify(db, n.id, "Hospital pickup", `${patient.name} ordered medicines for collection at Ridge pharmacy.`));
      notify(db, patientId, "Pharmacy queue", "The dispensary has your list. Collect at Ridge Campus pharmacy when the nurse marks it ready.");
      await emailPatient(db, patientId, {
        type: "account",
        subject: "Pharmacy collection at Ridge Campus",
        heading: "Your medicines are with the dispensary",
        intro: "You asked to collect this prescription at the hospital. A pharmacy nurse will prepare it.",
        details: [
          ["Order", order.id],
          ["Items", taken.lines.map((l) => `${l.name} ×${l.qty}`).join(", ")],
          ["Amount", `GHS ${taken.amount}`],
        ],
      });
    } else {
      notify(db, patientId, "Pharmacy billed", `GHS ${taken.amount} is due. Pay to complete the purchase.`);
    }
    writeDb(db);
    broadcastStock(db);
    io.emit("pharmacy-order", enrichOrder(db, order));
    res.status(201).json({ order: enrichOrder(db, order), invoice });
  });

  app.patch("/api/pharmacy/orders/:id", async (req, res) => {
    const db = readDb();
    const actor = db.users.find((u) => u.id === req.body.actorId);
    const order = (db.pharmacyOrders || []).find((o) => o.id === req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found." });
    const next = req.body.status;
    if (next === "cancelled" && order.status === "queued") {
      restoreStock(db, order.items);
      order.status = "cancelled";
      order.cancelledAt = new Date().toISOString();
      notify(db, order.patientId, "Pharmacy order cancelled", "The dispensary could not fill that list. Stock was returned to the shelf.");
    } else if (["ready", "collected"].includes(next)) {
      if (!actor || !["nurse", "admin"].includes(actor.role)) {
        return res.status(403).json({ message: "Only pharmacy nurses can dispense." });
      }
      order.status = next;
      order.nurseId = actor.id;
      order.nurseName = actor.name;
      if (next === "ready") {
        order.readyAt = new Date().toISOString();
        notify(db, order.patientId, "Medicines ready", "Your hospital pickup is ready at Ridge Campus pharmacy.");
        await emailPatient(db, order.patientId, {
          type: "account",
          subject: "Your medicines are ready for collection",
          heading: "Ready at Ridge pharmacy",
          intro: `${actor.name} has prepared your order. Bring a Ghana Card or the CareBridge confirmation.`,
          details: [["Order", order.id], ["Amount", `GHS ${order.amount}`]],
        });
      }
      if (next === "collected") order.collectedAt = new Date().toISOString();
    } else {
      return res.status(400).json({ message: "That status change is not allowed." });
    }
    audit(db, { actorId: req.body.actorId, action: "pharmacy.update", entity: "order", entityId: order.id, detail: order.status });
    writeDb(db);
    broadcastStock(db);
    io.emit("pharmacy-order", enrichOrder(db, order));
    res.json(enrichOrder(db, order));
  });
}
