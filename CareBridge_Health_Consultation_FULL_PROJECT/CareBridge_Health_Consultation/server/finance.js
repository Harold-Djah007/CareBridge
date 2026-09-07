import { audit } from "./clinical.js";
import { markPharmacyPaid, catalogStock, isSellable } from "./pharmacy.js";
import { flutterwaveStatus, paymentMatchesVerification, startFlutterwavePayment, validFlutterwaveWebhook, verifyFlutterwaveTransaction } from "./flutterwave.js";

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
    pharmacy: catalogStock(db.pharmacyStock || PHARMACY),
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
  const lines = [];
  for (const row of items || []) {
    const product = catalog.find((p) => p.id === row.id || p.id === row.productId);
    if (!product) return { error: "Unknown catalog item.", status: 400 };
    const qty = Math.max(1, Number(row.qty || 1));
    const price = Number(product.price || 0);
    lines.push({ ...product, price, qty, lineTotal: price * qty });
  }
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

export function mountFinance(app, { readDb, writeDb, safeUser, notify, emailPatient, io, clearUserCart, removeCartKinds }) {
  app.get("/api/finance/accounts", (_, res) => res.json(ACCOUNTS));
  app.get("/api/finance/pharmacy", (_, res) => {
    const db = readDb();
    res.json(catalogStock(db.pharmacyStock || PHARMACY));
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
    const actor = req.authUser;
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
    if (!req.authUser) return res.status(401).json({ message: "Sign in to view payments." });
    const db = readDb();
    let rows = db.payments || [];
    if (req.authUser.role !== "admin") rows = rows.filter((p) => p.patientId === req.authUser.id);
    res.json(rows.slice().reverse().map((p) => ({
      ...publicPayment(p),
      patient: safeUser(db.users.find((u) => u.id === p.patientId) || {}),
    })));
  });

  const placeOrder = (kind) => async (req, res) => {
    if (!req.authUser) return res.status(401).json({ message: "Sign in to place an order." });
    const { items = [] } = req.body;
    const patientId = req.authUser.role === "patient" ? req.authUser.id : req.body.patientId;
    const actorId = req.authUser.id;
    const db = readDb();
    if (!patientId || !(db.users || []).some((u) => u.id === patientId && u.role === "patient")) return res.status(400).json({ message: "Choose a valid patient." });
    const t = tariffOf(db);
    const catalog = kind === "lab" ? t.labs : (db.pharmacyStock || PHARMACY);
    if (kind === "pharmacy") {
      for (const row of items) {
        const product = catalog.find((p) => p.id === row.id || p.id === row.productId);
        const qty = Math.max(1, Number(row.qty || 1));
        if (!product) return res.status(400).json({ message: "Unknown medicine." });
        const available = Number(product.qty || 0);
        if (!isSellable(product) || available < qty) {
          return res.status(409).json({ message: `Only ${Math.max(0, available)} units are currently available.`, available: Math.max(0, available) });
        }
      }
    }
    const built = orderFromCatalog(catalog, items, kind);
    if (built.error) return res.status(built.status || 400).json({ message: built.error });
    const { lines, amount } = built;
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
    removeCartKinds?.(db, patientId, [kind === "lab" ? "lab" : "med"]);
    writeDb(db);
    if (kind === "pharmacy") io?.emit("pharmacy-stock", catalogStock(db.pharmacyStock || PHARMACY));
    res.status(201).json(invoice);
  };

  app.post("/api/finance/pharmacy/order", placeOrder("pharmacy"));
  app.post("/api/finance/labs/order", placeOrder("lab"));

  app.post("/api/finance/services/order", async (req, res) => {
    if (!req.authUser) return res.status(401).json({ message: "Sign in to order a hospital service." });
    const patientId = req.authUser.role === "patient" ? req.authUser.id : req.body.patientId;
    const serviceId = req.body.serviceId;
    const actorId = req.authUser.id;
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

  const gatewayMethods = new Set(["card", "momo", "bank"]);
  const manualMethods = new Set(["cash", "nhis"]);

  const publicPayment = (payment = {}) => {
    const { providerPayload, providerErrorPayload, ...safe } = payment;
    return safe;
  };

  const invoicesForPayment = (db, payment) => {
    const ids = payment?.invoiceIds?.length ? payment.invoiceIds : [payment?.invoiceId];
    return ids.map((id) => (db.invoices || []).find((row) => row.id === id)).filter(Boolean);
  };

  const methodLabel = (payment) => {
    if (payment.method === "card") return "Flutterwave card";
    if (payment.method === "momo") return `Flutterwave ${(payment.network || "MoMo").toUpperCase()}`;
    if (payment.method === "bank") return "Flutterwave bank transfer";
    if (payment.method === "nhis") return `NHIS ${payment.nhisNumber || "claim"}`;
    return "Cash at Ridge cashier";
  };

  const completePayment = async (db, payment, verification = null, actorId = "flutterwave") => {
    if (!payment) throw Object.assign(new Error("Payment not found."), { status: 404 });
    if (payment.status === "paid") return { payment, invoices: invoicesForPayment(db, payment) };
    if (gatewayMethods.has(payment.method) && !paymentMatchesVerification(payment, verification)) {
      throw Object.assign(new Error("Flutterwave verification does not match this CareBridge payment."), { status: 400 });
    }

    const invoices = invoicesForPayment(db, payment);
    if (!invoices.length) throw Object.assign(new Error("The invoices for this payment could not be found."), { status: 404 });
    const stamp = new Date().toISOString();
    payment.status = "paid";
    payment.confirmedAt = stamp;
    payment.verifiedAt = stamp;
    payment.requiresManualReview = false;
    payment.providerStatus = verification?.status || payment.providerStatus || "manual";
    if (verification?.id) payment.gatewayTransactionId = String(verification.id);
    if (verification?.flw_ref) payment.flwRef = verification.flw_ref;

    const label = methodLabel(payment);
    invoices.forEach((row) => {
      row.status = "paid";
      row.paidAt = stamp;
      row.receiptNo = payment.receiptNo;
      row.paymentId = payment.id;
      row.method = label;
    });
    markPharmacyPaid(db, invoices);
    clearUserCart?.(db, payment.patientId);
    audit(db, {
      actorId,
      action: gatewayMethods.has(payment.method) ? "payment.verify" : "payment.manual-confirm",
      entity: "payment",
      entityId: payment.id,
      detail: `${payment.receiptNo} · ${payment.currency} ${payment.amount}`,
    });
    notify(db, payment.patientId, "Payment received", `Receipt ${payment.receiptNo} · GHS ${payment.amount}`);
    await emailPatient(db, payment.patientId, {
      type: "account",
      subject: `Receipt ${payment.receiptNo} from CareBridge`,
      heading: "Payment received",
      intro: "Your payment has been verified and posted to the hospital accounts.",
      details: [
        ["Receipt", payment.receiptNo],
        ["Reference", payment.reference],
        ["Amount", `GHS ${payment.amount}`],
        ["Method", label],
        ["Item", invoices.map((i) => i.item).join("; ") || "Hospital services"],
      ],
    });
    writeDb(db);
    io?.to(payment.patientId).emit("payment-updated", publicPayment(payment));
    return { payment, invoices };
  };

  const refreshGatewayPayment = async (db, payment, transactionId = null) => {
    if (!payment || !gatewayMethods.has(payment.method) || payment.status === "paid") return { payment, invoices: invoicesForPayment(db, payment) };
    const id = transactionId || payment.gatewayTransactionId;
    if (!id) return { payment, invoices: invoicesForPayment(db, payment) };
    const verification = await verifyFlutterwaveTransaction(id);
    payment.lastVerifiedAt = new Date().toISOString();
    payment.providerStatus = verification?.status || payment.providerStatus || "pending";
    if (verification?.id) payment.gatewayTransactionId = String(verification.id);
    if (verification?.flw_ref) payment.flwRef = verification.flw_ref;
    if (paymentMatchesVerification(payment, verification)) {
      return completePayment(db, payment, verification);
    }
    if (["failed", "cancelled"].includes(String(verification?.status || "").toLowerCase())) {
      payment.status = "failed";
      payment.failedAt = new Date().toISOString();
    }
    writeDb(db);
    return { payment, invoices: invoicesForPayment(db, payment), verification };
  };

  const rejectAdminPay = (req, res) => {
    const actor = req.authUser;
    if (!actor) {
      res.status(401).json({ message: "Sign in before starting checkout." });
      return true;
    }
    if (actor.role !== "patient") {
      res.status(403).json({ message: "Checkout is available from a patient account; staff review and fulfil orders." });
      return true;
    }
    return false;
  };

  app.get("/api/finance/payment-config", (_, res) => {
    const fw = flutterwaveStatus();
    res.json({
      currency: "GHS",
      flutterwave: fw,
      methods: [
        { id: "card", online: true, enabled: fw.configured },
        { id: "momo", online: true, enabled: fw.configured },
        { id: "bank", online: true, enabled: fw.configured },
        { id: "nhis", online: false, enabled: true },
        { id: "cash", online: false, enabled: true },
      ],
    });
  });

  app.post("/api/finance/checkout", async (req, res) => {
    const db = readDb();
    if (rejectAdminPay(req, res)) return;
    const inv = (db.invoices || []).find((i) => i.id === req.body.invoiceId);
    if (!inv) return res.status(404).json({ message: "Invoice not found" });
    if (inv.status === "paid") return res.status(400).json({ message: "This invoice is already paid." });
    if (inv.patientId !== req.authUser.id) return res.status(403).json({ message: "That bill is not on your patient file." });
    return startPayment(req, res, db, [inv]);
  });

  app.post("/api/finance/checkout-cart", async (req, res) => {
    const db = readDb();
    if (rejectAdminPay(req, res)) return;
    const pid = req.authUser.id;
    const patient = (db.users || []).find((u) => u.id === pid && u.role === "patient");
    if (!patient) return res.status(404).json({ message: "Patient not found." });
    const checkoutKey = String(req.body.checkoutKey || "").trim().slice(0, 120);
    const invoices = [];
    for (const id of req.body.invoiceIds || []) {
      const inv = (db.invoices || []).find((i) => i.id === id && i.patientId === pid && i.status === "due");
      if (inv && !invoices.some((x) => x.id === inv.id)) invoices.push(inv);
    }
    for (const svc of req.body.services || []) {
      const service = tariffOf(db).services.find((s) => s.id === svc.id || s.id === svc.productId);
      if (!service) return res.status(400).json({ message: "That hospital service is not on the tariff." });
      const qty = Math.max(1, Math.min(50, Number(svc.qty || 1) || 1));
      const price = Number(service.price || 0);
      let invoice = checkoutKey && (db.invoices || []).find((row) => (
        row.patientId === pid
        && row.status === "due"
        && row.checkoutKey === checkoutKey
        && row.sourceProductId === service.id
        && Number(row.sourceQty || 1) === qty
      ));
      if (!invoice) {
        invoice = addInvoice(db, {
          patientId: pid,
          item: qty > 1 ? `${service.name} ×${qty}` : service.name,
          amount: price * qty,
          category: "service",
          nhis: service.nhis,
          checkoutKey: checkoutKey || undefined,
          sourceProductId: service.id,
          sourceQty: qty,
          lines: [{ ...service, price, qty, lineTotal: price * qty }],
        });
      }
      if (!invoices.some((row) => row.id === invoice.id)) invoices.push(invoice);
    }
    if (!invoices.length) return res.status(400).json({ message: "Your cart is empty. Add a bill or a hospital service first." });
    return startPayment(req, res, db, invoices);
  });

  async function startPayment(req, res, db, invoices) {
    const method = req.body.method;
    if (!["card", "momo", "bank", "nhis", "cash"].includes(method)) {
      return res.status(400).json({ message: "Choose card, Mobile Money, bank transfer, NHIS, or cash." });
    }
    if (gatewayMethods.has(method) && !flutterwaveStatus().configured) {
      return res.status(503).json({
        message: "Online checkout is ready but Flutterwave is not configured. Add FLW_SECRET_KEY and FLW_SECRET_HASH to server/.env, then restart CareBridge.",
      });
    }
    if (!invoices.length || invoices.some((i) => i.status !== "due")) {
      return res.status(400).json({ message: "Only unpaid invoices can be checked out." });
    }
    if (new Set(invoices.map((i) => i.patientId)).size !== 1) {
      return res.status(400).json({ message: "A checkout can only contain bills for one patient." });
    }
    const patient = (db.users || []).find((u) => u.id === invoices[0].patientId);
    if (!patient) return res.status(404).json({ message: "Patient not found." });
    const network = req.body.network || "mtn";
    const amount = Number(invoices.reduce((s, i) => s + Number(i.amount || 0), 0).toFixed(2));
    if (!(amount > 0)) return res.status(400).json({ message: "The checkout total must be greater than zero." });
    const payment = {
      id: `pay${Date.now()}${Math.floor(Math.random() * 900)}`,
      invoiceId: invoices[0].id,
      invoiceIds: invoices.map((i) => i.id),
      patientId: invoices[0].patientId,
      amount,
      currency: "GHS",
      method,
      network,
      phone: String(req.body.phone || patient.phone || "").trim(),
      payerName: String(req.body.payerName || patient.name || "").trim(),
      nhisNumber: String(req.body.nhisNumber || "").trim(),
      reference: payRef(),
      receiptNo: receiptNo(),
      status: "pending",
      requiresManualReview: manualMethods.has(method),
      checkoutKey: String(req.body.checkoutKey || "").trim().slice(0, 120) || undefined,
      createdAt: new Date().toISOString(),
    };
    db.payments = db.payments || [];
    db.payments.push(payment);
    audit(db, { actorId: req.authUser?.id || payment.patientId, action: "payment.start", entity: "payment", entityId: payment.id, detail: `${method} GHS ${amount}` });
    writeDb(db);

    if (manualMethods.has(method)) {
      payment.destination = method === "nhis"
        ? { type: "nhis", scheme: "National Health Insurance Scheme" }
        : ACCOUNTS.cashier;
      writeDb(db);
      return res.status(201).json({ payment: publicPayment(payment), invoices, invoice: invoices[0], mode: "manual_review" });
    }

    try {
      const result = await startFlutterwavePayment({ req, payment, user: patient });
      payment.provider = "flutterwave";
      payment.providerMode = result.mode;
      payment.gatewayTransactionId = result.gatewayTransactionId || payment.gatewayTransactionId || null;
      payment.flwRef = result.flwRef || payment.flwRef || null;
      payment.bankTransfer = result.bankTransfer || null;
      payment.providerInitiatedAt = new Date().toISOString();
      writeDb(db);
      return res.status(201).json({
        payment: publicPayment(payment),
        invoices,
        invoice: invoices[0],
        mode: result.mode,
        checkoutUrl: result.checkoutUrl || null,
        bankTransfer: result.bankTransfer || null,
      });
    } catch (error) {
      payment.status = "failed";
      payment.failedAt = new Date().toISOString();
      payment.providerError = error.message;
      writeDb(db);
      return res.status(error.status || 502).json({
        message: error.message || "Flutterwave checkout could not be started.",
        payment: publicPayment(payment),
      });
    }
  }

  app.post("/api/finance/verify", async (req, res) => {
    if (!req.authUser) return res.status(401).json({ message: "Sign in to verify this payment." });
    const db = readDb();
    const payment = (db.payments || []).find((p) => p.id === req.body.paymentId || p.reference === req.body.txRef);
    if (!payment) return res.status(404).json({ message: "Payment not found." });
    if (req.authUser.role !== "admin" && payment.patientId !== req.authUser.id) return res.status(403).json({ message: "That payment is not on your patient file." });
    if (!gatewayMethods.has(payment.method)) return res.status(400).json({ message: "That payment is reviewed by hospital accounts, not Flutterwave." });
    try {
      const result = await refreshGatewayPayment(db, payment, req.body.transactionId);
      return res.json({ payment: publicPayment(result.payment), invoices: result.invoices, invoice: result.invoices?.[0] || null });
    } catch (error) {
      return res.status(error.status || 502).json({ message: error.message || "Payment verification failed." });
    }
  });

  app.get("/api/finance/payments/:id/status", async (req, res) => {
    if (!req.authUser) return res.status(401).json({ message: "Sign in to view this payment." });
    const db = readDb();
    const payment = (db.payments || []).find((p) => p.id === req.params.id);
    if (!payment) return res.status(404).json({ message: "Payment not found." });
    if (req.authUser.role !== "admin" && payment.patientId !== req.authUser.id) return res.status(403).json({ message: "That payment is not on your patient file." });
    try {
      const last = payment.lastVerifiedAt ? new Date(payment.lastVerifiedAt).getTime() : 0;
      const dueForRefresh = String(req.query.refresh) === "1" && Date.now() - last > 8000;
      const result = dueForRefresh ? await refreshGatewayPayment(db, payment) : { payment, invoices: invoicesForPayment(db, payment) };
      return res.json({ payment: publicPayment(result.payment), invoices: result.invoices, invoice: result.invoices?.[0] || null });
    } catch (error) {
      return res.status(error.status || 502).json({ message: error.message || "Could not refresh payment status.", payment: publicPayment(payment) });
    }
  });

  app.post("/api/finance/confirm", async (req, res) => {
    const db = readDb();
    const actor = req.authUser;
    if (!actor || actor.role !== "admin") return res.status(403).json({ message: "Only hospital operations can manually confirm offline payments." });
    const payment = (db.payments || []).find((p) => p.id === req.body.paymentId);
    if (!payment) return res.status(404).json({ message: "Payment not found." });
    if (!manualMethods.has(payment.method)) return res.status(400).json({ message: "Card, Mobile Money, and bank payments must be verified by Flutterwave." });
    if (payment.status === "paid") return res.json({ payment: publicPayment(payment), invoices: invoicesForPayment(db, payment) });
    try {
      const result = await completePayment(db, payment, null, actor.id);
      return res.json({ payment: publicPayment(result.payment), invoices: result.invoices, invoice: result.invoices[0] || null });
    } catch (error) {
      return res.status(error.status || 500).json({ message: error.message || "Could not confirm the payment." });
    }
  });

  app.post(["/api/payments/webhook", "/api/finance/webhook"], async (req, res) => {
    if (!validFlutterwaveWebhook(req)) return res.status(401).send("Invalid signature");
    const eventName = req.body?.event || req.body?.type;
    const data = req.body?.data || {};
    if (eventName && eventName !== "charge.completed") return res.sendStatus(200);
    if (!data.id) return res.sendStatus(200);
    try {
      const verification = await verifyFlutterwaveTransaction(data.id);
      const db = readDb();
      const payment = (db.payments || []).find((p) => p.reference === verification?.tx_ref);
      if (!payment) return res.sendStatus(200);
      if (!paymentMatchesVerification(payment, verification)) {
        payment.providerStatus = verification?.status || "mismatch";
        payment.lastVerifiedAt = new Date().toISOString();
        writeDb(db);
        return res.sendStatus(200);
      }
      await completePayment(db, payment, verification);
      return res.sendStatus(200);
    } catch (error) {
      console.error("Flutterwave webhook verification failed:", error.message);
      return res.sendStatus(500);
    }
  });

  app.get("/api/receipts/:id", (req, res) => {
    if (!req.authUser) return res.status(401).json({ message: "Sign in to view a receipt." });
    const db = readDb();
    const key = decodeURIComponent(req.params.id);
    const payment = (db.payments || []).find((p) => p.id === key || p.receiptNo === key);
    if (payment) {
      if (req.authUser.role !== "admin" && payment.patientId !== req.authUser.id) return res.status(403).json({ message: "That receipt is not on your patient file." });
      const invoice = (db.invoices || []).find((i) => i.id === payment.invoiceId);
      return res.json(receiptPayload(db, publicPayment(payment), invoice));
    }
    const invoice = (db.invoices || []).find((i) => i.id === key || i.receiptNo === key);
    if (invoice && invoice.status === "paid") {
      if (req.authUser.role !== "admin" && invoice.patientId !== req.authUser.id) return res.status(403).json({ message: "That receipt is not on your patient file." });
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
