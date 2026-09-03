import { audit } from "./clinical.js";

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

export function consultFee(db, { doctorId, mode }) {
  const doctor = db.users.find((u) => u.id === doctorId) || {};
  const specialty = CONSULT_RATES[doctor.specialty] || 380;
  const modeFee = mode === "video" ? 0 : CAMPUS_SURCHARGE;
  return specialty + modeFee;
}

export function wardFee({ ward, roomType, nights }) {
  const base = WARD_RATES[ward] || 650;
  const room = ROOM_SURCHARGE[roomType] || 0;
  return (base + room) * Math.max(1, Number(nights || 1));
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
  return { payment, invoice, patient: safe, hospital: ACCOUNTS };
}

export function mountFinance(app, { readDb, writeDb, safeUser, notify, emailPatient }) {
  app.get("/api/finance/accounts", (_, res) => res.json(ACCOUNTS));
  app.get("/api/finance/pharmacy", (_, res) => res.json(PHARMACY));
  app.get("/api/finance/labs", (_, res) => res.json(LABS));
  app.get("/api/finance/rates", (_, res) => res.json({
    currency: "GHS",
    consults: CONSULT_RATES,
    campusSurcharge: CAMPUS_SURCHARGE,
    consultNote: "Consultant fee follows specialty. A campus visit adds GHS 80 for clinic overhead. Video is the listed specialist fee.",
    wards: WARD_RATES,
    rooms: ROOM_SURCHARGE,
    wardNote: "Nightly ward rate plus room supplement, multiplied by nights. Invoiced when admissions accept the bed.",
    labs: LABS,
    pharmacy: PHARMACY,
    services: SERVICES,
    accounts: ACCOUNTS,
  }));

  app.get("/api/finance/payments", (req, res) => {
    const db = readDb();
    const { userId, role } = req.query;
    let rows = db.payments || [];
    if (role === "patient") rows = rows.filter((p) => p.patientId === userId);
    res.json(rows.slice().reverse());
  });

  const placeOrder = (catalog, kind) => async (req, res) => {
    const { patientId, items = [], actorId } = req.body;
    const db = readDb();
    const { lines, amount } = orderFromCatalog(catalog, items, kind);
    if (!lines.length) return res.status(400).json({ message: "Choose at least one item." });
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
    res.status(201).json(invoice);
  };

  app.post("/api/finance/pharmacy/order", placeOrder(PHARMACY, "pharmacy"));
  app.post("/api/finance/labs/order", placeOrder(LABS, "lab"));

  app.post("/api/finance/services/order", async (req, res) => {
    const { patientId, serviceId, actorId } = req.body;
    const service = SERVICES.find((s) => s.id === serviceId);
    if (!service) return res.status(404).json({ message: "Service not on the tariff." });
    const db = readDb();
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
    const method = req.body.method;
    if (!["momo", "bank", "nhis", "cash"].includes(method)) {
      return res.status(400).json({ message: "Choose MoMo, bank transfer, NHIS, or cash." });
    }
    const network = req.body.network || "mtn";
    const payment = {
      id: `pay${Date.now()}`,
      invoiceId: inv.id,
      patientId: inv.patientId,
      amount: inv.amount,
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
      inv.status = "paid";
      inv.method = "Cash at Ridge cashier";
      inv.paidAt = payment.createdAt;
      inv.receiptNo = payment.receiptNo;
      inv.paymentId = payment.id;
    }
    audit(db, { actorId: req.body.actorId, action: "payment.start", entity: "payment", entityId: payment.id, detail: `${method} GHS ${inv.amount}` });
    writeDb(db);
    res.status(201).json({ payment, invoice: inv, accounts: ACCOUNTS });
  });

  app.post("/api/finance/confirm", async (req, res) => {
    const db = readDb();
    const payment = (db.payments || []).find((p) => p.id === req.body.paymentId);
    if (!payment) return res.status(404).json({ message: "Payment not found" });
    const inv = (db.invoices || []).find((i) => i.id === payment.invoiceId);
    payment.status = "paid";
    payment.confirmedAt = new Date().toISOString();
    if (inv) {
      inv.status = "paid";
      inv.paidAt = payment.confirmedAt;
      inv.receiptNo = payment.receiptNo;
      inv.paymentId = payment.id;
      inv.method = payment.method === "momo"
        ? `${(payment.network || "MoMo").toUpperCase()} ${payment.phone}`
        : payment.method === "bank"
          ? `GCB transfer ${payment.reference}`
          : payment.method === "nhis"
            ? `NHIS ${payment.nhisNumber}`
            : "Cash";
    }
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
        ["Item", inv?.item || "Hospital services"],
        ["Settled to", payment.method === "momo" ? `MoMo ${payment.destination?.number}` : payment.method === "bank" ? `GCB ${ACCOUNTS.bank.accountNumber}` : "Ridge cashier / NHIS"],
      ],
    });
    writeDb(db);
    res.json({ payment, invoice: inv });
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
