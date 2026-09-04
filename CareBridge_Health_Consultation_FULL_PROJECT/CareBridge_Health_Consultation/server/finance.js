import { audit } from "./clinical.js";
import { markPharmacyPaid, publicStock } from "./pharmacy.js";

export const ACCOUNTS = {
  bank: {
    bank: "GCB Bank PLC",
    accountName: "CareBridge Medical Centre Ltd",
    accountNumber: "1011130022847",
    branch: "Ridge — Accra",
    swift: "GHCBGHAC",
    sortCode: "040101",
  },
  momo: {
    name: "CareBridge Medical Centre",
    merchantId: "CB-RIDGE-001",
    mtn: "0245550100",
    telecel: "0205550100",
    at: "0275550100",
  },
  cashier: {
    desk: "Ridge Campus accounts, ground floor",
    hours: "Monday–Saturday 07:00–20:00",
  },
};

export const CONSULT_RATES = {
  Cardiology: 520,
  Pediatrics: 350,
  Orthopedics: 480,
  "General Medicine": 380,
};

export const CAMPUS_SURCHARGE = 80;

export const WARD_RATES = {
  "General Ward": 650,
  "Medical Ward": 800,
  "Maternity Ward": 900,
  "Pediatric Ward": 700,
};

export const ROOM_SURCHARGE = {
  "Shared Room": 0,
  "Private Room": 250,
  "Premium Private Room": 550,
};

export const LABS = [
  { id: "lab1", name: "Full blood count", specimen: "Venous blood", price: 85, nhis: true },
  { id: "lab2", name: "Malaria RDT + microscopy", specimen: "Capillary blood", price: 45, nhis: true },
  { id: "lab3", name: "Fasting blood glucose", specimen: "Venous blood", price: 40, nhis: true },
  { id: "lab4", name: "Lipid profile", specimen: "Venous blood", price: 120, nhis: true },
  { id: "lab5", name: "Liver function tests", specimen: "Venous blood", price: 150, nhis: true },
  { id: "lab6", name: "Renal function tests", specimen: "Venous blood", price: 140, nhis: true },
  { id: "lab7", name: "Urinalysis", specimen: "Midstream urine", price: 35, nhis: true },
  { id: "lab8", name: "COVID-19 / influenza PCR", specimen: "Nasopharyngeal swab", price: 280, nhis: false },
];

export const SERVICES = [
  { id: "svc1", name: "Outpatient registration", price: 40, nhis: true },
  { id: "svc2", name: "12-lead ECG", price: 120, nhis: true },
  { id: "svc3", name: "Wound dressing", price: 90, nhis: true },
  { id: "svc4", name: "Obstetric ultrasound", price: 250, nhis: true },
  { id: "svc5", name: "Chest X-ray", price: 180, nhis: true },
  { id: "svc6", name: "Ambulance transfer (Accra metro)", price: 450, nhis: false },
];

export const PHARMACY = [
  { id: "ph1", sku: "AML-5-30", name: "Amlodipine 5 mg", pack: "30 tablets", price: 48, nhis: true },
  { id: "ph2", sku: "PCM-500-20", name: "Paracetamol 500 mg", pack: "20 tablets", price: 12, nhis: true },
  { id: "ph3", sku: "IBU-400-15", name: "Ibuprofen 400 mg", pack: "15 tablets", price: 22, nhis: false },
  { id: "ph4", sku: "AMX-500-21", name: "Amoxicillin 500 mg", pack: "21 capsules", price: 35, nhis: true },
  { id: "ph5", sku: "OMZ-20-14", name: "Omeprazole 20 mg", pack: "14 capsules", price: 40, nhis: true },
  { id: "ph6", sku: "ORS-10", name: "ORS sachets", pack: "10 sachets", price: 18, nhis: true },
  { id: "ph7", sku: "GLU-50", name: "Glucose test strips", pack: "50 strips", price: 85, nhis: false },
  { id: "ph8", sku: "VIT-D-30", name: "Vitamin D3 1000 IU", pack: "30 tablets", price: 55, nhis: false },
];

export function defaultTariff() {
  return {
    currency: "GHS",
    consults: { ...CONSULT_RATES },
    campusSurcharge: CAMPUS_SURCHARGE,
    consultNote: "Consultant fee follows specialty. A campus visit adds the campus surcharge for clinic overhead. Video is the listed specialist fee.",
    wards: { ...WARD_RATES },
    rooms: { ...ROOM_SURCHARGE },
    wardNote: "Nightly ward rate plus room supplement, multiplied by nights. Invoiced when admissions accept the bed.",
    labs: LABS.map((row) => ({ ...row })),
    services: SERVICES.map((row) => ({ ...row })),
  };
}

export function ensureTariff(db) {
  let dirty = false;
  if (!db.tariff) {
    db.tariff = defaultTariff();
    dirty = true;
  } else {
    const seed = defaultTariff();
    db.tariff.consults = { ...seed.consults, ...(db.tariff.consults || {}) };
    db.tariff.wards = { ...seed.wards, ...(db.tariff.wards || {}) };
    db.tariff.rooms = { ...seed.rooms, ...(db.tariff.rooms || {}) };
    if (db.tariff.campusSurcharge === undefined) db.tariff.campusSurcharge = seed.campusSurcharge;
    if (!Array.isArray(db.tariff.labs) || !db.tariff.labs.length) db.tariff.labs = seed.labs;
    if (!Array.isArray(db.tariff.services) || !db.tariff.services.length) db.tariff.services = seed.services;
    if (!db.tariff.consultNote) db.tariff.consultNote = seed.consultNote;
    if (!db.tariff.wardNote) db.tariff.wardNote = seed.wardNote;
  }
  return dirty;
}

export function tariffOf(db) {
  ensureTariff(db);
  return db.tariff;
}

export function ratesPayload(db) {
  const t = tariffOf(db);
  return {
    currency: t.currency || "GHS",
    consults: t.consults,
    campusSurcharge: Number(t.campusSurcharge || 0),
    consultNote: t.consultNote,
    wards: t.wards,
    rooms: t.rooms,
    wardNote: t.wardNote,
    labs: t.labs,
    services: t.services,
    pharmacy: (db.pharmacyStock || PHARMACY).map(publicStock),
    accounts: ACCOUNTS,
    updatedAt: t.updatedAt || null,
    updatedBy: t.updatedBy || null,
  };
}

export function consultFee(db, { doctorId, mode }) {
  const t = tariffOf(db);
  const doctor = db.users.find((u) => u.id === doctorId) || {};
  const specialty = t.consults[doctor.specialty] || 380;
  const modeFee = mode === "video" ? 0 : Number(t.campusSurcharge || 0);
  return specialty + modeFee;
}

export function wardFee(row, db) {
  const t = db ? tariffOf(db) : { wards: WARD_RATES, rooms: ROOM_SURCHARGE };
  const base = t.wards[row.ward] || 650;
  const room = t.rooms[row.roomType] || 0;
  return (base + room) * Math.max(1, Number(row.nights || 1));
}

const receiptNo = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `CBM-${y}${m}${day}-${Math.floor(100000 + Math.random() * 900000)}`;
};

const payRef = () => `CBPAY${Date.now().toString().slice(-10)}`;

export function addInvoice(db, row) {
  const invoice = {
    id: `inv${Date.now()}${Math.floor(Math.random() * 99)}`,
    currency: "GHS",
    status: "due",
    method: "",
    date: new Date().toISOString().slice(0, 10),
    ...row,
  };
  db.invoices = db.invoices || [];
  db.invoices.push(invoice);
  return invoice;
}

function orderFromCatalog(catalog, items, label) {
  const lines = items.map((row) => {
    const product = catalog.find((p) => p.id === row.id);
    if (!product) return null;
    const qty = Math.max(1, Number(row.qty || 1));
    return { ...product, qty, lineTotal: product.price * qty };
  }).filter(Boolean);
  const amount = lines.reduce((s, l) => s + l.lineTotal, 0);
  return { lines, amount, label };
}

function receiptPayload(db, payment, invoice) {
  const patient = (db.users.find((u) => u.id === (payment?.patientId || invoice?.patientId)) || {});
  const { password, ...safe } = patient;
  const ids = payment?.invoiceIds?.length ? payment.invoiceIds : [payment?.invoiceId || invoice?.id];
  const invoices = ids.map((id) => (db.invoices || []).find((i) => i.id === id)).filter(Boolean);
  const lines = invoices.flatMap((inv) => inv.lines || [{ name: inv.item, lineTotal: inv.amount }]);
  return { payment, invoice: invoices[0] || invoice, invoices, lines, patient: safe, hospital: ACCOUNTS };
}

export function mountFinance(app, { readDb, writeDb, safeUser, notify, emailPatient, io }) {
  app.get("/api/finance/accounts", (_, res) => res.json(ACCOUNTS));
  app.get("/api/finance/pharmacy", (_, res) => {
    const db = readDb();
    res.json((db.pharmacyStock || PHARMACY).map(publicStock));
  });
  app.get("/api/finance/labs", (_, res) => {
    const db = readDb();
    res.json(tariffOf(db).labs);
  });
  app.get("/api/finance/rates", (_, res) => {
    const db = readDb();
    res.json(ratesPayload(db));
  });

  app.patch("/api/finance/rates", (req, res) => {
    const db = readDb();
    const actor = db.users.find((u) => u.id === req.body.actorId);
    if (!actor || !["doctor", "admin"].includes(actor.role)) {
      return res.status(403).json({ message: "Only consultants and operations can change the hospital tariff." });
    }
    const t = tariffOf(db);
    const numMap = (obj) => {
      const next = {};
      Object.entries(obj || {}).forEach(([k, v]) => {
        const key = String(k).trim();
        if (!key) return;
        next[key] = Math.max(0, Number(v) || 0);
      });
      return next;
    };
    if (req.body.consults) t.consults = { ...t.consults, ...numMap(req.body.consults) };
    if (req.body.wards) t.wards = { ...t.wards, ...numMap(req.body.wards) };
    if (req.body.rooms) t.rooms = { ...t.rooms, ...numMap(req.body.rooms) };
    if (req.body.campusSurcharge !== undefined) t.campusSurcharge = Math.max(0, Number(req.body.campusSurcharge) || 0);
    if (req.body.consultNote !== undefined) t.consultNote = String(req.body.consultNote);
    if (req.body.wardNote !== undefined) t.wardNote = String(req.body.wardNote);
    if (Array.isArray(req.body.labs)) {
      t.labs = req.body.labs.map((row, i) => ({
        id: row.id || `lab${Date.now()}${i}`,
        name: String(row.name || "").trim() || "Laboratory test",
        specimen: String(row.specimen || "Specimen"),
        price: Math.max(0, Number(row.price) || 0),
        nhis: Boolean(row.nhis),
      }));
    }
    if (Array.isArray(req.body.services)) {
      t.services = req.body.services.map((row, i) => ({
        id: row.id || `svc${Date.now()}${i}`,
        name: String(row.name || "").trim() || "Hospital service",
        price: Math.max(0, Number(row.price) || 0),
        nhis: Boolean(row.nhis),
      }));
    }
    if (Array.isArray(req.body.pharmacy)) {
      req.body.pharmacy.forEach((row) => {
        const stock = (db.pharmacyStock || []).find((p) => p.id === row.id);
        if (!stock) return;
        if (row.price !== undefined) stock.price = Math.max(0, Number(row.price) || 0);
        if (row.nhis !== undefined) stock.nhis = Boolean(row.nhis);
      });
    }
    t.updatedAt = new Date().toISOString();
    t.updatedBy = actor.name;
    audit(db, { actorId: actor.id, action: "tariff.update", entity: "tariff", entityId: "hospital", detail: actor.name });
    writeDb(db);
    const payload = ratesPayload(db);
    io?.emit("tariff-updated", payload);
    io?.emit("pharmacy-stock", payload.pharmacy);
    res.json(payload);
  });

  app.get("/api/finance/payments", (req, res) => {
    const db = readDb();
    const { userId, role } = req.query;
    let rows = db.payments || [];
    if (role === "patient") rows = rows.filter((p) => p.patientId === userId);
    res.json(rows.slice().reverse());
  });

  const placeOrder = (kind) => async (req, res) => {
    const { patientId, items = [], actorId } = req.body;
    const db = readDb();
    const t = tariffOf(db);
    const catalog = kind === "lab" ? t.labs : (db.pharmacyStock || PHARMACY);
    if (kind === "pharmacy") {
      for (const row of items) {
        const product = catalog.find((p) => p.id === row.id);
        const qty = Math.max(1, Number(row.qty || 1));
        if (!product) return res.status(400).json({ message: "Unknown medicine." });
        if (Number(product.qty || 0) < qty) {
          return res.status(400).json({ message: `${product.name} is ${Number(product.qty || 0) === 0 ? "out of stock" : `short — only ${product.qty} left`}.` });
        }
      }
    }
    const { lines, amount } = orderFromCatalog(catalog, items, kind);
    if (!lines.length) return res.status(400).json({ message: "Choose at least one item." });
    if (kind === "pharmacy") {
      lines.forEach((line) => {
        const product = db.pharmacyStock.find((p) => p.id === line.id);
        if (product) product.qty = Number(product.qty || 0) - line.qty;
      });
    }
    const invoice = addInvoice(db, {
      patientId,
      item: `${kind === "lab" ? "Laboratory" : "Pharmacy"} · ${lines.map((l) => `${l.name} ×${l.qty}`).join(", ")}`,
      amount,
      category: kind === "lab" ? "lab" : "pharmacy",
      lines,
    });
    audit(db, { actorId, action: `${kind}.order`, entity: "invoice", entityId: invoice.id, detail: invoice.item });
    notify(db, patientId, kind === "lab" ? "Lab request" : "Pharmacy order", `GHS ${amount} is due. Pay to proceed.`);
    writeDb(db);
    if (kind === "pharmacy") io?.emit("pharmacy-stock", (db.pharmacyStock || []).map(publicStock));
    res.status(201).json(invoice);
  };

  app.post("/api/finance/pharmacy/order", placeOrder("pharmacy"));
  app.post("/api/finance/labs/order", placeOrder("lab"));

  app.post("/api/finance/services/order", async (req, res) => {
    const { patientId, serviceId, actorId } = req.body;
    const db = readDb();
    const service = tariffOf(db).services.find((s) => s.id === serviceId);
    if (!service) return res.status(404).json({ message: "Service not on the tariff." });
    const invoice = addInvoice(db, {
      patientId,
      item: service.name,
      amount: service.price,
      category: "service",
      nhis: service.nhis,
    });
    audit(db, { actorId, action: "service.order", entity: "invoice", entityId: invoice.id, detail: service.name });
    notify(db, patientId, "Service billed", `${service.name} · GHS ${service.price}`);
    writeDb(db);
    res.status(201).json(invoice);
  });

  app.post("/api/finance/checkout", async (req, res) => {
    const db = readDb();
    const inv = (db.invoices || []).find((i) => i.id === req.body.invoiceId);
    if (!inv) return res.status(404).json({ message: "Invoice not found" });
    if (inv.status === "paid") return res.status(400).json({ message: "This invoice is already paid." });
    return startPayment(req, res, db, [inv]);
  });

  app.post("/api/finance/checkout-cart", async (req, res) => {
    const db = readDb();
    const pid = req.body.patientId;
    if (!pid) return res.status(400).json({ message: "Patient is required." });
    const invoices = [];
    for (const id of req.body.invoiceIds || []) {
      const inv = (db.invoices || []).find((i) => i.id === id && i.patientId === pid && i.status === "due");
      if (inv && !invoices.some((x) => x.id === inv.id)) invoices.push(inv);
    }
    for (const svc of req.body.services || []) {
      const service = tariffOf(db).services.find((s) => s.id === svc.id);
      if (!service) continue;
      const qty = Math.max(1, Number(svc.qty || 1));
      invoices.push(addInvoice(db, {
        patientId: pid,
        item: qty > 1 ? `${service.name} ×${qty}` : service.name,
        amount: service.price * qty,
        category: "service",
        nhis: service.nhis,
      }));
    }
    if (!invoices.length) return res.status(400).json({ message: "Your cart is empty. Add a bill or a hospital service first." });
    return startPayment(req, res, db, invoices);
  });

  function startPayment(req, res, db, invoices) {
    const method = req.body.method;
    if (!["momo", "bank", "nhis", "cash"].includes(method)) {
      return res.status(400).json({ message: "Choose MoMo, bank transfer, NHIS, or cash." });
    }
    const network = req.body.network || "mtn";
    const amount = invoices.reduce((s, i) => s + Number(i.amount || 0), 0);
    const payment = {
      id: `pay${Date.now()}`,
      invoiceId: invoices[0].id,
      invoiceIds: invoices.map((i) => i.id),
      patientId: invoices[0].patientId,
      amount,
      currency: "GHS",
      method,
      network,
      phone: req.body.phone || "",
      payerName: req.body.payerName || "",
      nhisNumber: req.body.nhisNumber || "",
      reference: payRef(),
      receiptNo: receiptNo(),
      status: method === "cash" ? "paid" : "pending",
      destination: method === "momo"
        ? { type: "momo", network, merchant: ACCOUNTS.momo.name, merchantId: ACCOUNTS.momo.merchantId, number: ACCOUNTS.momo[network] || ACCOUNTS.momo.mtn }
        : method === "bank"
          ? ACCOUNTS.bank
          : method === "nhis"
            ? { type: "nhis", scheme: "National Health Insurance Scheme" }
            : ACCOUNTS.cashier,
      createdAt: new Date().toISOString(),
    };
    db.payments = db.payments || [];
    db.payments.push(payment);
    if (payment.status === "paid") {
      invoices.forEach((inv) => {
        inv.status = "paid";
        inv.method = "Cash at Ridge cashier";
        inv.paidAt = payment.createdAt;
        inv.receiptNo = payment.receiptNo;
        inv.paymentId = payment.id;
      });
      markPharmacyPaid(db, invoices);
    }
    audit(db, { actorId: req.body.actorId, action: "payment.start", entity: "payment", entityId: payment.id, detail: `${method} GHS ${amount}` });
    writeDb(db);
    res.status(201).json({ payment, invoices, invoice: invoices[0], accounts: ACCOUNTS });
  }

  app.post("/api/finance/confirm", async (req, res) => {
    const db = readDb();
    const payment = (db.payments || []).find((p) => p.id === req.body.paymentId);
    if (!payment) return res.status(404).json({ message: "Payment not found" });
    const ids = payment.invoiceIds?.length ? payment.invoiceIds : [payment.invoiceId];
    const invoices = ids.map((id) => (db.invoices || []).find((i) => i.id === id)).filter(Boolean);
    const inv = invoices[0];
    payment.status = "paid";
    payment.confirmedAt = new Date().toISOString();
    const methodLabel = payment.method === "momo"
      ? `${(payment.network || "MoMo").toUpperCase()} ${payment.phone}`
      : payment.method === "bank"
        ? `GCB transfer ${payment.reference}`
        : payment.method === "nhis"
          ? `NHIS ${payment.nhisNumber}`
          : "Cash";
    invoices.forEach((row) => {
      row.status = "paid";
      row.paidAt = payment.confirmedAt;
      row.receiptNo = payment.receiptNo;
      row.paymentId = payment.id;
      row.method = methodLabel;
    });
    markPharmacyPaid(db, invoices);
    audit(db, { actorId: req.body.actorId, action: "payment.confirm", entity: "payment", entityId: payment.id, detail: payment.receiptNo });
    notify(db, payment.patientId, "Payment received", `Receipt ${payment.receiptNo} · GHS ${payment.amount}`);
    await emailPatient(db, payment.patientId, {
      type: "account",
      subject: `Receipt ${payment.receiptNo} from CareBridge`,
      heading: "Payment received",
      intro: "Your payment has been posted to the hospital accounts. Keep this receipt for NHIS or employer claims.",
      details: [
        ["Receipt", payment.receiptNo],
        ["Reference", payment.reference],
        ["Amount", `GHS ${payment.amount}`],
        ["Method", inv?.method || payment.method],
        ["Item", invoices.map((i) => i.item).join("; ") || "Hospital services"],
        ["Settled to", payment.method === "momo" ? `MoMo ${payment.destination?.number}` : payment.method === "bank" ? `GCB ${ACCOUNTS.bank.accountNumber}` : "Ridge cashier / NHIS"],
      ],
    });
    writeDb(db);
    res.json({ payment, invoice: inv, invoices });
  });

  app.get("/api/receipts/:id", (req, res) => {
    const db = readDb();
    const key = decodeURIComponent(req.params.id);
    const payment = (db.payments || []).find((p) => p.id === key || p.receiptNo === key);
    if (payment) {
      const invoice = (db.invoices || []).find((i) => i.id === payment.invoiceId);
      return res.json(receiptPayload(db, payment, invoice));
    }
    const invoice = (db.invoices || []).find((i) => i.id === key || i.receiptNo === key);
    if (invoice && invoice.status === "paid") {
      const linked = (db.payments || []).find((p) => p.invoiceId === invoice.id);
      const synthetic = linked || {
        id: invoice.id,
        receiptNo: invoice.receiptNo || invoice.id,
        amount: invoice.amount,
        method: invoice.method,
        reference: invoice.receiptNo || invoice.id,
        confirmedAt: invoice.paidAt,
        createdAt: invoice.paidAt,
        patientId: invoice.patientId,
        status: "paid",
      };
      return res.json(receiptPayload(db, synthetic, invoice));
    }
    res.status(404).json({ message: "Receipt not found" });
  });
}
