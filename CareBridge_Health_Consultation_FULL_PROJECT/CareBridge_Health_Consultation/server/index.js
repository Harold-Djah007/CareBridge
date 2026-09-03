import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import http from "http";
import { Server } from "socket.io";
import { deliverEmail, renderEmail, shouldEmail } from "./email.js";
import { audit, ensureClinical, mountClinical } from "./clinical.js";
import { addInvoice, consultFee, mountFinance, wardFee } from "./finance.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, "data", "db.json");

const readDb = () => {
  const db = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  db.emails = db.emails || [];
  db.wards = db.wards || [];
  db.payments = db.payments || [];
  return ensureClinical(db);
};
const writeDb = (db) => fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: true, methods: ["GET", "POST"] },
});

app.use(cors());
app.use(express.json());

const initials = (name = "") =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase() || "CB";

const safeUser = (u = {}) => {
  const { password, ...rest } = u;
  return rest;
};

const notify = (db, userId, title, body) => {
  db.notifications.push({
    id: `n${Date.now()}${Math.floor(Math.random() * 1000)}`,
    userId,
    title,
    body,
    read: false,
  });
  io.to(userId).emit("notification", { title, body });
};

const emailPatient = async (db, userId, { type, subject, heading, intro, details, closing, text }) => {
  const user = db.users.find((u) => u.id === userId);
  if (!shouldEmail(user, type)) return null;
  const html = renderEmail({
    heading,
    intro,
    details: details || [],
    closing: closing || "Open CareBridge anytime to review details or message your care team.",
  });
  const record = await deliverEmail(db, {
    userId,
    to: user.email,
    subject,
    text: text || `${intro}\n\n${(details || []).map(([k, v]) => `${k}: ${v}`).join("\n")}`,
    html,
    type,
  });
  io.to(userId).emit("email-alert", { subject, type, id: record.id });
  return record;
};

const enrichAppointment = (db, a) => {
  const invoice = (db.invoices || []).find((i) => i.appointmentId === a.id);
  return {
    ...a,
    patient: safeUser(db.users.find((u) => u.id === a.patientId) || {}),
    doctor: safeUser(db.users.find((u) => u.id === a.doctorId) || {}),
    fee: invoice?.amount ?? consultFee(db, a),
    invoiceId: invoice?.id,
    invoiceStatus: invoice?.status,
  };
};

const enrichBooking = (db, w) => {
  const invoice = (db.invoices || []).find((i) => i.bookingId === w.id);
  return {
    ...w,
    patient: safeUser(db.users.find((u) => u.id === w.patientId) || {}),
    fee: invoice?.amount ?? wardFee(w),
    invoiceId: invoice?.id,
    invoiceStatus: invoice?.status,
  };
};

const requireFields = (body, fields) => fields.filter((f) => !String(body[f] ?? "").trim());

app.get("/api/health", (_, res) => res.json({ ok: true, name: "CareBridge API" }));

app.post("/api/login", (req, res) => {
  const { email, password } = req.body;
  const db = readDb();
  const user = db.users.find(
    (u) => u.email.toLowerCase() === String(email).toLowerCase() && u.password === password
  );
  if (!user) return res.status(401).json({ message: "Incorrect email or password." });
  if (user.status === "inactive") {
    return res.status(403).json({ message: "This account has been deactivated. Contact administration." });
  }
  if (req.body.expectedRole && req.body.expectedRole !== user.role) {
    const hint = {
      patient: "Use the Patient tab.",
      doctor: "Use the Clinician tab.",
      admin: "Use the Operations tab.",
    }[user.role] || "Choose the matching portal.";
    return res.status(403).json({ message: `This account is a ${user.role}. ${hint}` });
  }
  audit(db, { actorId: user.id, action: "login", entity: "user", entityId: user.id, detail: `${user.role} signed in` });
  writeDb(db);
  res.json({ user: safeUser(user) });
});

app.post("/api/register", async (req, res) => {
  const missing = requireFields(req.body, ["name", "email", "password"]);
  if (missing.length) return res.status(400).json({ message: `Please fill in ${missing.join(", ")}.` });
  const db = readDb();
  if (db.users.some((u) => u.email.toLowerCase() === String(req.body.email).toLowerCase())) {
    return res.status(409).json({ message: "An account with that email already exists." });
  }
  const user = {
    id: `p${Date.now()}`,
    role: "patient",
    name: req.body.name.trim(),
    email: req.body.email.trim(),
    password: req.body.password,
    avatar: initials(req.body.name),
    specialty: "",
    phone: req.body.phone || "",
    city: req.body.city || "",
    insurance: req.body.insurance || "Self-pay",
    about: "New CareBridge patient.",
    status: "active",
    mrn: `CBM-${100000 + db.users.filter((u) => u.role === "patient").length + 1}`,
    allergies: "None recorded",
    emailAlerts: true,
    alertPrefs: { appointments: true, wards: true, messages: true, account: true },
  };
  db.users.push(user);
  db.users.filter((u) => u.role === "admin").forEach((a) => {
    notify(db, a.id, "New patient registered", `${user.name} created a patient account.`);
  });
  await emailPatient(db, user.id, {
    type: "account",
    subject: "Welcome to CareBridge Health",
    heading: "Your patient account is ready",
    intro: `Hello ${user.name}, welcome to CareBridge. You can now book video consultations, chat with doctors, and reserve a ward before you arrive.`,
    details: [
      ["Email", user.email],
      ["Portal", "Patient"],
    ],
    closing: "Keep email alerts on so you never miss a scheduled visit or ward update.",
  });
  writeDb(db);
  res.status(201).json({ user: safeUser(user) });
});

app.patch("/api/users/:id", (req, res) => {
  const db = readDb();
  const user = db.users.find((u) => u.id === req.params.id);
  if (!user) return res.status(404).json({ message: "User not found" });
  const allowed = ["name", "phone", "city", "about", "specialty", "available", "years", "emailAlerts", "alertPrefs", "emergencyContact", "allergies", "insurance", "bloodType", "dob"];
  allowed.forEach((key) => {
    if (req.body[key] !== undefined) user[key] = req.body[key];
  });
  if (req.body.name) user.avatar = initials(req.body.name);
  writeDb(db);
  res.json(safeUser(user));
});

app.get("/api/doctors", (_, res) => {
  const db = readDb();
  res.json(db.users.filter((u) => u.role === "doctor" && u.status !== "inactive").map(safeUser));
});

app.get("/api/patients", (_, res) => {
  const db = readDb();
  res.json(db.users.filter((u) => u.role === "patient" && u.status !== "inactive").map(safeUser));
});

app.get("/api/contacts", (req, res) => {
  const { userId, role } = req.query;
  const db = readDb();
  if (role === "patient") {
    return res.json(db.users.filter((u) => u.role === "doctor" && u.status !== "inactive").map(safeUser));
  }
  if (role === "admin") {
    return res.json(db.users.filter((u) => u.id !== userId && u.status !== "inactive").map(safeUser));
  }
  const ids = new Set();
  db.appointments.filter((a) => a.doctorId === userId).forEach((a) => ids.add(a.patientId));
  db.wardBookings.forEach((w) => ids.add(w.patientId));
  db.messages.forEach((m) => {
    String(m.roomId)
      .split("-")
      .forEach((p) => {
        if (p !== userId) ids.add(p);
      });
  });
  const patients = db.users.filter((u) => u.role === "patient" && ids.has(u.id) && u.status !== "inactive").map(safeUser);
  res.json(patients.length ? patients : db.users.filter((u) => u.role === "patient" && u.status !== "inactive").map(safeUser));
});

app.get("/api/appointments", (req, res) => {
  const { userId, role } = req.query;
  const db = readDb();
  let rows = db.appointments;
  if (role === "patient") rows = rows.filter((a) => a.patientId === userId);
  if (role === "doctor") rows = rows.filter((a) => a.doctorId === userId);
  res.json(rows.map((a) => enrichAppointment(db, a)));
});

app.post("/api/appointments", async (req, res) => {
  const missing = requireFields(req.body, ["patientId", "doctorId", "date", "time"]);
  if (missing.length) return res.status(400).json({ message: "Please choose a doctor, date, and time." });
  const db = readDb();
  const item = {
    id: `apt${Date.now()}`,
    patientId: req.body.patientId,
    doctorId: req.body.doctorId,
    date: req.body.date,
    time: req.body.time,
    reason: req.body.reason || "Consultation",
    status: req.body.status || "confirmed",
    mode: req.body.mode || "video",
  };
  db.appointments.push(item);
  const doctor = db.users.find((u) => u.id === item.doctorId) || {};
  const fee = consultFee(db, item);
  addInvoice(db, {
    patientId: item.patientId,
    item: `${item.mode === "video" ? "Video" : "Campus"} consultation · ${doctor.specialty || "Clinic"} · ${item.date}`,
    amount: fee,
    category: "consult",
    appointmentId: item.id,
  });
  notify(db, item.doctorId, "New appointment", `A patient booked ${item.date} at ${item.time}.`);
  db.users.filter((u) => u.role === "admin").forEach((a) => {
    notify(db, a.id, "Appointment booked", `New visit scheduled for ${item.date} at ${item.time}.`);
  });
  notify(db, item.patientId, "Consultation scheduled", `Your visit with ${doctor.name || "your doctor"} is set for ${item.date} at ${item.time}.`);
  await emailPatient(db, item.patientId, {
    type: "appointment",
    subject: "Your CareBridge consultation is scheduled",
    heading: "Consultation scheduled",
    intro: `Your ${item.mode === "video" ? "video" : "in-person"} consultation has been booked.`,
    details: [
      ["Doctor", doctor.name || "Assigned clinician"],
      ["Date", item.date],
      ["Time", item.time],
      ["Reason", item.reason],
      ["Status", item.status],
      ["Fee", `GHS ${fee} (pay in Billing — NHIS, MoMo, bank or cash)`],
    ],
    closing: "Join from Video consultation in CareBridge, or message your doctor if you need to change the time.",
  });
  writeDb(db);
  res.status(201).json(enrichAppointment(db, item));
});

app.patch("/api/appointments/:id", async (req, res) => {
  const db = readDb();
  const item = db.appointments.find((a) => a.id === req.params.id);
  if (!item) return res.status(404).json({ message: "Appointment not found" });
  Object.assign(item, req.body);
  if (req.body.status) {
    notify(db, item.patientId, `Appointment ${req.body.status}`, `Your visit on ${item.date} is now ${req.body.status}.`);
    if (item.doctorId !== req.body.actorId) {
      notify(db, item.doctorId, `Appointment ${req.body.status}`, `A visit on ${item.date} is now ${req.body.status}.`);
    }
    const doctor = db.users.find((u) => u.id === item.doctorId) || {};
    await emailPatient(db, item.patientId, {
      type: "appointment",
      subject: `Your consultation is ${req.body.status}`,
      heading: `Consultation ${req.body.status}`,
      intro: `There is an update to your scheduled visit with ${doctor.name || "your doctor"}.`,
      details: [
        ["Date", item.date],
        ["Time", item.time],
        ["Status", req.body.status],
        ["Mode", item.mode === "video" ? "Video" : "In person"],
      ],
    });
  }
  writeDb(db);
  res.json(enrichAppointment(db, item));
});

app.get("/api/wards", (_, res) => {
  const db = readDb();
  res.json(db.wards || []);
});

app.patch("/api/wards/:id", (req, res) => {
  const db = readDb();
  const ward = (db.wards || []).find((w) => w.id === req.params.id);
  if (!ward) return res.status(404).json({ message: "Ward not found" });
  ["name", "available", "capacity", "description"].forEach((key) => {
    if (req.body[key] !== undefined) {
      ward[key] = key === "available" || key === "capacity" ? Number(req.body[key]) : req.body[key];
    }
  });
  if (Array.isArray(req.body.amenities)) ward.amenities = req.body.amenities;
  writeDb(db);
  res.json(ward);
});

app.get("/api/ward-bookings", (req, res) => {
  const db = readDb();
  const { userId, role } = req.query;
  let rows = db.wardBookings;
  if (role === "patient") rows = rows.filter((w) => w.patientId === userId);
  res.json(rows.map((w) => enrichBooking(db, w)));
});

app.post("/api/ward-bookings", async (req, res) => {
  const missing = requireFields(req.body, ["patientId", "ward", "date"]);
  if (missing.length) return res.status(400).json({ message: "Please choose a ward and admission date." });
  const db = readDb();
  const item = {
    id: `wb${Date.now()}`,
    patientId: req.body.patientId,
    ward: req.body.ward,
    roomType: req.body.roomType || "Private Room",
    date: req.body.date,
    nights: Number(req.body.nights || 1),
    status: "pending",
    notes: req.body.notes || "",
  };
  db.wardBookings.push(item);
  db.users.filter((u) => u.role === "doctor" || u.role === "admin").forEach((u) => {
    notify(db, u.id, "New ward request", `${item.ward} requested for ${item.date}.`);
  });
  notify(db, item.patientId, "Ward request received", `Your ${item.ward} reservation for ${item.date} is pending review.`);
  await emailPatient(db, item.patientId, {
    type: "ward",
    subject: "We received your ward reservation request",
    heading: "Ward request received",
    intro: "Your hospital admission request is with the care team. We will email you again when it is accepted or updated.",
    details: [
      ["Ward", item.ward],
      ["Room", item.roomType],
      ["Arrival", item.date],
      ["Nights", String(item.nights)],
      ["Status", "Pending"],
      ["Estimated fee", `GHS ${wardFee(item)} (invoiced when the bed is accepted)`],
    ],
  });
  writeDb(db);
  res.status(201).json(enrichBooking(db, item));
});

app.patch("/api/ward-bookings/:id", async (req, res) => {
  const db = readDb();
  const item = db.wardBookings.find((w) => w.id === req.params.id);
  if (!item) return res.status(404).json({ message: "Ward booking not found" });
  const prev = item.status;
  Object.assign(item, req.body);
  if (req.body.status && req.body.status !== prev) {
    const accepted = req.body.status === "confirmed";
    notify(
      db,
      item.patientId,
      accepted ? "Ward reservation accepted" : `Ward booking ${req.body.status}`,
      accepted
        ? `Your ${item.ward} bed is confirmed for ${item.date}.`
        : `Your ${item.ward} reservation is now ${req.body.status}.`
    );
    if (accepted) {
      const ward = (db.wards || []).find((w) => w.name === item.ward);
      if (ward && ward.available > 0) ward.available -= 1;
      const fee = wardFee(item);
      addInvoice(db, {
        patientId: item.patientId,
        item: `${item.ward} · ${item.roomType} × ${item.nights} night(s)`,
        amount: fee,
        category: "ward",
        bookingId: item.id,
      });
    }
    if (prev === "confirmed" && req.body.status === "declined") {
      const ward = (db.wards || []).find((w) => w.name === item.ward);
      if (ward) ward.available += 1;
    }
    await emailPatient(db, item.patientId, {
      type: "ward",
      subject: accepted ? "Your ward reservation has been accepted" : `Ward reservation ${req.body.status}`,
      heading: accepted ? "Ward accepted" : `Ward ${req.body.status}`,
      intro: accepted
        ? "Good news — your hospital bed is reserved. You can arrive knowing your ward is ready."
        : `Your ward reservation was updated to ${req.body.status}.`,
      details: [
        ["Ward", item.ward],
        ["Room", item.roomType],
        ["Arrival", item.date],
        ["Nights", String(item.nights)],
        ["Status", req.body.status],
        ...(accepted ? [["Admission fee", `GHS ${wardFee(item)} — pay by NHIS, MoMo, GCB, or cash`]] : []),
      ],
      closing: accepted
        ? "Bring your ID and any recent lab results. Message your doctor if your arrival time changes."
        : "If you still need a bed, send a new request or chat with your care team.",
    });
  }
  writeDb(db);
  res.json(enrichBooking(db, item));
});

app.get("/api/messages/:roomId", (req, res) => {
  const db = readDb();
  res.json(db.messages.filter((m) => m.roomId === req.params.roomId));
});

app.get("/api/notifications/:userId", (req, res) => {
  const db = readDb();
  res.json(db.notifications.filter((n) => n.userId === req.params.userId).reverse());
});

app.patch("/api/notifications/:userId/read", (req, res) => {
  const db = readDb();
  db.notifications.forEach((n) => {
    if (n.userId === req.params.userId) n.read = true;
  });
  writeDb(db);
  res.json({ ok: true });
});

app.get("/api/emails/:userId", (req, res) => {
  const db = readDb();
  const rows = (db.emails || []).filter((e) => e.userId === req.params.userId).reverse();
  res.json(rows);
});

app.get("/api/admin/emails", (_, res) => {
  const db = readDb();
  res.json([...(db.emails || [])].reverse());
});

app.post("/api/emails/test", async (req, res) => {
  const { userId } = req.body;
  const db = readDb();
  const user = db.users.find((u) => u.id === userId);
  if (!user) return res.status(404).json({ message: "User not found" });
  notify(db, user.id, "Test email alert", "This is a sample CareBridge email alert.");
  const record = await emailPatient(db, user.id, {
    type: "test",
    subject: "CareBridge test email alert",
    heading: "Email alerts are working",
    intro: `Hi ${user.name}, this is a test alert from CareBridge. You will receive emails like this when a consultation is scheduled or a ward request is accepted.`,
    details: [
      ["Inbox", user.email],
      ["Alerts", user.emailAlerts === false ? "Off" : "On"],
    ],
  });
  if (!record) {
    writeDb(db);
    return res.status(400).json({ message: "Email alerts are turned off in your profile." });
  }
  writeDb(db);
  res.status(201).json(record);
});

app.get("/api/admin/overview", (_, res) => {
  const db = readDb();
  res.json({
    patients: db.users.filter((u) => u.role === "patient").length,
    doctors: db.users.filter((u) => u.role === "doctor").length,
    admins: db.users.filter((u) => u.role === "admin").length,
    appointments: db.appointments.length,
    pendingAppointments: db.appointments.filter((a) => a.status === "pending").length,
    wardBookings: db.wardBookings.length,
    pendingWards: db.wardBookings.filter((w) => w.status === "pending").length,
    messages: db.messages.length,
    bedsAvailable: (db.wards || []).reduce((sum, w) => sum + Number(w.available || 0), 0),
  });
});

mountClinical(app, { readDb, writeDb, safeUser, notify, emailPatient });
mountFinance(app, { readDb, writeDb, safeUser, notify, emailPatient });

app.get("/api/admin/users", (_, res) => {
  const db = readDb();
  res.json(db.users.map(safeUser));
});

app.post("/api/admin/users", (req, res) => {
  const missing = requireFields(req.body, ["name", "email", "password", "role"]);
  if (missing.length) return res.status(400).json({ message: "Name, email, password, and role are required." });
  const role = req.body.role;
  if (!["patient", "doctor", "admin"].includes(role)) {
    return res.status(400).json({ message: "Role must be patient, doctor, or admin." });
  }
  const db = readDb();
  if (db.users.some((u) => u.email.toLowerCase() === String(req.body.email).toLowerCase())) {
    return res.status(409).json({ message: "That email is already in use." });
  }
  const prefix = role === "admin" ? "adm" : role[0];
  const user = {
    id: `${prefix}${Date.now()}`,
    role,
    name: req.body.name.trim(),
    email: req.body.email.trim(),
    password: req.body.password,
    avatar: initials(req.body.name),
    specialty: req.body.specialty || (role === "admin" ? "Hospital Administration" : ""),
    phone: req.body.phone || "",
    city: req.body.city || "",
    about: req.body.about || "",
    status: "active",
    available: role === "doctor" ? true : undefined,
    years: role === "doctor" ? Number(req.body.years || 1) : undefined,
    emailAlerts: true,
    alertPrefs: { appointments: true, wards: true, messages: true, account: true },
  };
  db.users.push(user);
  writeDb(db);
  res.status(201).json(safeUser(user));
});

app.patch("/api/admin/users/:id", (req, res) => {
  const db = readDb();
  const user = db.users.find((u) => u.id === req.params.id);
  if (!user) return res.status(404).json({ message: "User not found" });
  ["name", "email", "phone", "city", "about", "specialty", "role", "status", "available", "years", "password"].forEach((key) => {
    if (req.body[key] !== undefined && req.body[key] !== "") user[key] = req.body[key];
  });
  if (req.body.name) user.avatar = initials(req.body.name);
  writeDb(db);
  res.json(safeUser(user));
});

io.on("connection", (socket) => {
  socket.on("join-user", (userId) => socket.join(userId));
  socket.on("join-room", (roomId) => socket.join(roomId));

  socket.on("chat-message", async (message) => {
    const db = readDb();
    const record = { ...message, id: `m${Date.now()}`, timestamp: new Date().toISOString() };
    db.messages.push(record);
    const sender = db.users.find((u) => u.id === message.senderId);
    const recipientId = String(message.roomId)
      .split("-")
      .find((id) => id !== message.senderId);
    const recipient = db.users.find((u) => u.id === recipientId);
    if (sender && recipient?.role === "patient" && sender.role !== "patient") {
      notify(db, recipient.id, "New care message", `${sender.name} sent you a message.`);
      await emailPatient(db, recipient.id, {
        type: "message",
        subject: `New message from ${sender.name}`,
        heading: "You have a new care message",
        intro: `${sender.name} wrote to you on CareBridge.`,
        details: [
          ["From", sender.name],
          ["Preview", String(message.text || "").slice(0, 160)],
        ],
        closing: "Open Messages in CareBridge to reply.",
      });
    }
    writeDb(db);
    io.to(message.roomId).emit("chat-message", record);
  });

  socket.on("webrtc-offer", ({ roomId, offer }) => socket.to(roomId).emit("webrtc-offer", { offer }));
  socket.on("webrtc-answer", ({ roomId, answer }) => socket.to(roomId).emit("webrtc-answer", { answer }));
  socket.on("webrtc-ice", ({ roomId, candidate }) => socket.to(roomId).emit("webrtc-ice", { candidate }));
});

const dist = path.join(__dirname, "..", "client", "dist");
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get("/{*path}", (_, res) => res.sendFile(path.join(dist, "index.html")));
}

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`CareBridge server running on http://localhost:${PORT}`));
