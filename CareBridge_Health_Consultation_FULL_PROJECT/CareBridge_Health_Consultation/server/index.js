import "./load-env.js";
import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import http from "http";
import { Server } from "socket.io";
import { deliverEmail, renderEmail, shouldEmail } from "./email.js";
import { audit, ensureClinical, mountClinical } from "./clinical.js";
import { addInvoice, consultFee, ensureTariff, mountFinance, wardFee } from "./finance.js";
import { mountSupport } from "./support.js";
import { mountCases } from "./cases.js";
import { ensurePharmacy, mountPharmacy } from "./pharmacy.js";
import { ensureCarts, mountCart, clearUserCart, removeCartKinds } from "./cart.js";
import { mountWardAutomation } from "./wardAutomation.js";
import {
  activeSessionsForUser,
  authSessionFromRequest,
  authUserFromRequest,
  ensurePasswordSecurity,
  hashPassword,
  issueSession,
  passwordMatches,
  revokeAllUserSessions,
  revokeSession,
  validatePassword,
} from "./auth.js";
import { createDurableJsonStore } from "./persistence.js";
import { installSecurity } from "./security.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = process.env.DATA_FILE ? path.resolve(process.env.DATA_FILE) : path.join(__dirname, "data", "db.json");
const store = createDurableJsonStore(DATA_FILE);

const readDb = () => {
  const db = store.read();
  db.emails = db.emails || [];
  db.wards = db.wards || [];
  db.payments = db.payments || [];
  db.tickets = db.tickets || [];
  db.messageReads = db.messageReads || {};
  ensureClinical(db);
  const dirty = ensurePharmacy(db) | ensureTariff(db) | ensureCarts(db) | ensurePasswordSecurity(db);
  if (dirty) store.write(db);
  return db;
};
const writeDb = (db) => store.write(db);

const app = express();
const server = http.createServer(app);
const allowedOrigins = String(process.env.CLIENT_URLS || process.env.CLIENT_URL || "")
  .split(",")
  .map((value) => value.trim().replace(/\/$/, ""))
  .filter(Boolean);
const corsOptions = allowedOrigins.length
  ? {
      credentials: true,
      origin(origin, callback) {
        if (!origin || allowedOrigins.includes(String(origin).replace(/\/$/, ""))) return callback(null, true);
        return callback(new Error("Origin is not allowed by CareBridge CORS policy."));
      },
    }
  : { origin: true, credentials: true };
const io = new Server(server, {
  cors: { ...corsOptions, methods: ["GET", "POST"] },
});

app.disable("x-powered-by");
app.set("trust proxy", 1);
installSecurity(app, {
  readiness: () => ({
    persistence: store.health(),
    environment: process.env.NODE_ENV || "development",
    configuredOrigins: allowedOrigins.length,
  }),
});
app.use(cors(corsOptions));
app.use(express.json({
  limit: "1mb",
  verify: (req, _res, buffer) => {
    req.rawBody = buffer.toString("utf8");
  },
}));

app.use("/api", (req, _res, next) => {
  if (!req.headers.authorization) return next();
  const db = readDb();
  req.authSession = authSessionFromRequest(db, req);
  req.authUser = req.authSession
    ? (db.users || []).find((user) => user.id === req.authSession.userId && user.status !== "inactive") || null
    : null;
  return next();
});

const requireAuth = (...roles) => (req, res, next) => {
  if (!req.authUser) return res.status(401).json({ message: "Your session has expired. Please sign in again." });
  if (roles.length && !roles.includes(req.authUser.role)) return res.status(403).json({ message: "You do not have permission to perform this action." });
  return next();
};

const applyPhoto = (user, photo) => {
  if (photo === undefined) return null;
  if (!photo) {
    user.photo = "";
    return null;
  }
  if (typeof photo !== "string" || !photo.startsWith("data:image/")) {
    return "Upload a photo file.";
  }
  if (photo.length > 450000) return "That photo is too large. Choose a smaller picture.";
  user.photo = photo;
  return null;
};

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
  const portraits = { d1: "/portraits/d1.jpg", d2: "/portraits/d2.jpg", d3: "/portraits/d3.jpg", d4: "/portraits/d4.jpg" };
  if (!rest.photo && portraits[rest.id]) rest.photo = portraits[rest.id];
  return rest;
};

const roomOf = (a, b) => [a, b].filter(Boolean).sort().join("-");

const withThread = (db, person, userId) => {
  const roomId = roomOf(userId, person.id);
  const thread = (db.messages || []).filter((m) => m.roomId === roomId);
  const last = thread[thread.length - 1] || null;
  const lastRead = db.messageReads?.[userId]?.[roomId];
  const unread = thread.filter((m) => m.senderId !== userId && (!lastRead || String(m.timestamp) > String(lastRead))).length;
  return {
    ...safeUser(person),
    lastMessage: last ? { text: last.text, timestamp: last.timestamp, senderId: last.senderId } : null,
    unread,
  };
};

const isUpcomingAppt = (item) => {
  if (!item?.date) return false;
  if (["cancelled", "declined", "completed"].includes(item.status)) return false;
  return `${item.date}T${item.time || "23:59"}` >= new Date().toISOString().slice(0, 16);
};

const unreadMessages = (db, userId) => {
  const reads = db.messageReads?.[userId] || {};
  return (db.messages || []).filter((m) => {
    const parts = String(m.roomId || "").split("-");
    if (!parts.includes(userId)) return false;
    if (m.senderId === userId) return false;
    const last = reads[m.roomId];
    return !last || String(m.timestamp) > String(last);
  }).length;
};

const markRoomRead = (db, userId, roomId) => {
  if (!userId || !roomId) return false;
  db.messageReads = db.messageReads || {};
  db.messageReads[userId] = db.messageReads[userId] || {};
  const stamp = new Date().toISOString();
  if (db.messageReads[userId][roomId] === stamp) return false;
  db.messageReads[userId][roomId] = stamp;
  return true;
};

const notify = (db, userId, title, body) => {
  const notification = {
    id: `n${Date.now()}${Math.floor(Math.random() * 1000)}`,
    userId,
    title,
    body,
    read: false,
    createdAt: new Date().toISOString(),
  };
  db.notifications.push(notification);
  io.to(userId).emit("notification", notification);
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
    fee: invoice?.amount ?? wardFee(w, db),
    invoiceId: invoice?.id,
    invoiceStatus: invoice?.status,
  };
};

const requireFields = (body, fields) => fields.filter((f) => !String(body[f] ?? "").trim());

app.get("/api/health", (req, res) => res.json({
  ok: true,
  name: "CareBridge API",
  requestId: req.id,
  uptimeSeconds: Math.round(process.uptime()),
  persistence: store.health().provider,
}));

app.post("/api/login", (req, res) => {
  const { email, password } = req.body;
  const db = readDb();
  const user = db.users.find(
    (u) => u.email.toLowerCase() === String(email).toLowerCase() && passwordMatches(password, u.password)
  );
  if (!user) return res.status(401).json({ message: "Incorrect email or password." });
  if (user.status === "inactive") {
    return res.status(403).json({ message: "This account has been deactivated. Contact administration." });
  }
  if (req.body.expectedRole && req.body.expectedRole !== user.role) {
    const hint = {
      patient: "Use the Patient tab.",
      doctor: "Use the Clinician tab.",
      nurse: "Use the Nurse tab.",
      admin: "Use the Operations tab.",
    }[user.role] || "Choose the matching portal.";
    return res.status(403).json({ message: `This account is a ${user.role}. ${hint}` });
  }
  const session = issueSession(db, user, req);
  audit(db, { actorId: user.id, action: "login", entity: "user", entityId: user.id, detail: `${user.role} signed in` });
  writeDb(db);
  res.json({ user: safeUser(user), token: session.token, expiresAt: session.expiresAt });
});

app.post("/api/logout", requireAuth(), (req, res) => {
  const db = readDb();
  revokeSession(db, req);
  writeDb(db);
  res.json({ ok: true });
});

app.post("/api/register", async (req, res) => {
  const missing = requireFields(req.body, ["name", "email", "password"]);
  if (missing.length) return res.status(400).json({ message: `Please fill in ${missing.join(", ")}.` });
  const policy = validatePassword(req.body.password);
  if (!policy.ok) return res.status(400).json({ message: policy.message, passwordPolicy: policy });
  const db = readDb();
  if (db.users.some((u) => u.email.toLowerCase() === String(req.body.email).toLowerCase())) {
    return res.status(409).json({ message: "An account with that email already exists." });
  }
  const user = {
    id: `p${Date.now()}`,
    role: "patient",
    name: req.body.name.trim(),
    email: req.body.email.trim(),
    password: hashPassword(req.body.password),
    avatar: initials(req.body.name),
    photo: "",
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
  const photoErr = applyPhoto(user, req.body.photo);
  if (photoErr) return res.status(400).json({ message: photoErr });
  db.users.push(user);
  db.users.filter((u) => u.role === "admin").forEach((a) => {
    notify(db, a.id, "New patient registered", `${user.name} created a patient account.`);
  });
  await emailPatient(db, user.id, {
    type: "account",
    subject: "Welcome to CareBridge Health",
    heading: "Your patient account is ready",
    intro: `Hello ${user.name}, welcome to CareBridge. Choose a consultant from the hospital directory, then book video or campus visits, pay published fees, and reserve a ward before you arrive.`,
    details: [
      ["Email", user.email],
      ["Portal", "Patient"],
    ],
    closing: "Keep email alerts on so you never miss a scheduled visit or ward update.",
  });
  const session = issueSession(db, user, req);
  writeDb(db);
  res.status(201).json({ user: safeUser(user), token: session.token, expiresAt: session.expiresAt });
});

const isPublicApiRequest = (req) => {
  const pathname = String(req.originalUrl || "").split("?")[0];
  return (
    (req.method === "GET" && pathname === "/api/doctors")
    || (req.method === "POST" && pathname === "/api/contact")
    || (req.method === "POST" && pathname === "/api/payments/webhook")
    || (req.method === "POST" && pathname === "/api/finance/webhook")
  );
};

app.use("/api", (req, res, next) => {
  if (isPublicApiRequest(req)) return next();
  if (!req.authUser) return res.status(401).json({ message: "Your session has expired. Please sign in again." });

  const claimedActorId = req.body?.actorId || req.body?.userId;
  if (claimedActorId && req.authUser.role !== "admin" && claimedActorId !== req.authUser.id) {
    return res.status(403).json({ message: "The requested action does not match your signed-in account." });
  }
  const queryUserId = req.query?.userId;
  if (queryUserId && req.authUser.role !== "admin" && queryUserId !== req.authUser.id) {
    return res.status(403).json({ message: "You can only request data for your signed-in account." });
  }
  if (req.query?.role && req.authUser.role !== "admin" && req.query.role !== req.authUser.role) {
    return res.status(403).json({ message: "The requested portal role does not match your account." });
  }
  if (req.authUser.role === "patient" && req.body?.patientId && req.body.patientId !== req.authUser.id) {
    return res.status(403).json({ message: "You can only submit actions for your own patient file." });
  }
  return next();
});

app.get("/api/security/sessions", requireAuth(), (req, res) => {
  const db = readDb();
  res.json({
    currentSessionId: req.authSession?.id || "",
    sessions: activeSessionsForUser(db, req.authUser.id),
  });
});

app.post("/api/security/sessions/revoke-others", requireAuth(), (req, res) => {
  const db = readDb();
  const revoked = revokeAllUserSessions(db, req.authUser.id, req.authSession?.id || "");
  audit(db, { actorId: req.authUser.id, action: "sessions.revoke-others", entity: "user", entityId: req.authUser.id, detail: `${revoked} other session(s) revoked` });
  writeDb(db);
  res.json({ ok: true, revoked });
});

mountWardAutomation(app, { readDb, writeDb, safeUser, notify, emailPatient, io, wardFee, addInvoice });

app.patch("/api/users/:id", requireAuth(), (req, res) => {
  const db = readDb();
  const user = db.users.find((u) => u.id === req.params.id);
  if (!user) return res.status(404).json({ message: "User not found" });
  if (req.authUser.id !== user.id && req.authUser.role !== "admin") return res.status(403).json({ message: "You can only update your own profile." });
  if (req.body.password) {
    if (!req.body.currentPassword || !passwordMatches(req.body.currentPassword, user.password)) {
      return res.status(400).json({ message: "Current password is incorrect." });
    }
    const policy = validatePassword(req.body.password);
    if (!policy.ok) return res.status(400).json({ message: policy.message, passwordPolicy: policy });
    user.password = hashPassword(req.body.password);
    revokeAllUserSessions(db, user.id, req.authSession?.id || "");
    audit(db, { actorId: req.authUser.id, action: "password.change", entity: "user", entityId: user.id, detail: "Password changed; other sessions revoked" });
  }
  if (req.body.email !== undefined) {
    const email = String(req.body.email).trim();
    if (!email) return res.status(400).json({ message: "Email is required." });
    if (db.users.some((u) => u.id !== user.id && u.email.toLowerCase() === email.toLowerCase())) {
      return res.status(409).json({ message: "That email is already in use." });
    }
    user.email = email;
  }
  if (req.body.preferredDoctorId) {
    const chosen = db.users.find((u) => u.id === req.body.preferredDoctorId && u.role === "doctor" && u.status !== "inactive");
    if (!chosen) return res.status(400).json({ message: "Choose a doctor from the hospital directory." });
    user.careTeamIds = [...new Set([...(user.careTeamIds || []), chosen.id])];
  }
  if (req.body.careTeamIds !== undefined) {
    if (!Array.isArray(req.body.careTeamIds)) return res.status(400).json({ message: "Care team must be a list of doctors." });
    user.careTeamIds = [...new Set(req.body.careTeamIds.filter((id) => db.users.some((u) => u.id === id && u.role === "doctor" && u.status !== "inactive")))];
  }
  const allowed = ["name", "phone", "city", "about", "specialty", "available", "years", "emailAlerts", "alertPrefs", "emergencyContact", "allergies", "insurance", "bloodType", "dob", "paymentPrefs", "preferredDoctorId"];
  allowed.forEach((key) => {
    if (req.body[key] !== undefined) user[key] = req.body[key];
  });
  const photoErr = applyPhoto(user, req.body.photo);
  if (photoErr) return res.status(400).json({ message: photoErr });
  if (req.body.name) user.avatar = initials(req.body.name);
  writeDb(db);
  if (user.role === "doctor" && req.body.available !== undefined) {
    io.emit("doctor-status", { id: user.id, available: user.available !== false, name: user.name, specialty: user.specialty, photo: safeUser(user).photo });
  }
  res.json(safeUser(user));
});

app.get("/api/doctors", (_, res) => {
  const db = readDb();
  res.json(db.users.filter((u) => u.role === "doctor" && u.status !== "inactive").map(safeUser));
});

app.get("/api/patients", requireAuth("doctor", "nurse", "admin"), (_, res) => {
  const db = readDb();
  res.json(db.users.filter((u) => u.role === "patient" && u.status !== "inactive").map(safeUser));
});

app.get("/api/contacts", (req, res) => {
  const { userId, role } = req.query;
  const db = readDb();
  if (role === "patient") {
    const me = db.users.find((u) => u.id === userId) || {};
    const ids = new Set([...(me.careTeamIds || []), me.preferredDoctorId].filter(Boolean));
    (db.appointments || []).filter((a) => a.patientId === userId).forEach((a) => ids.add(a.doctorId));
    (db.messages || []).forEach((m) => {
      const parts = String(m.roomId || "").split("-");
      if (parts.includes(userId)) parts.forEach((p) => { if (p !== userId) ids.add(p); });
    });
    return res.json(
      db.users
        .filter((u) => u.role === "doctor" && ids.has(u.id) && u.status !== "inactive")
        .map((u) => withThread(db, u, userId))
    );
  }
  if (role === "admin") {
    return res.json(db.users.filter((u) => u.id !== userId && u.status !== "inactive").map((u) => withThread(db, u, userId)));
  }
  if (role === "nurse") {
    return res.json(
      db.users
        .filter((u) => u.id !== userId && u.status !== "inactive" && (u.role === "doctor" || u.role === "admin"))
        .map((u) => withThread(db, u, userId))
    );
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
  const patients = db.users.filter((u) => u.role === "patient" && ids.has(u.id) && u.status !== "inactive").map((u) => withThread(db, u, userId));
  const caseload = patients.length ? patients : db.users.filter((u) => u.role === "patient" && u.status !== "inactive").map((u) => withThread(db, u, userId));
  const staff = db.users
    .filter((u) => u.id !== userId && u.status !== "inactive" && (u.role === "nurse" || u.role === "admin"))
    .map((u) => withThread(db, u, userId));
  res.json([...caseload, ...staff]);
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
  const doctor = db.users.find((u) => u.id === req.body.doctorId && u.role === "doctor" && u.status !== "inactive");
  if (!doctor) return res.status(400).json({ message: "Choose a doctor from the hospital directory." });
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
  const actor = req.authUser;
  const mayEdit = actor?.role === "admin" || (actor?.role === "doctor" && item.doctorId === actor.id) || (actor?.role === "patient" && item.patientId === actor.id);
  if (!mayEdit) return res.status(403).json({ message: "You cannot update this appointment." });
  const allowed = actor.role === "patient" ? ["status"] : ["status", "date", "time", "reason", "mode"];
  allowed.forEach((key) => { if (req.body[key] !== undefined) item[key] = req.body[key]; });
  if (req.body.status) {
    notify(db, item.patientId, `Appointment ${req.body.status}`, `Your visit on ${item.date} is now ${req.body.status}.`);
    if (item.doctorId !== actor.id) {
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
  if (req.authUser?.role !== "admin") return res.status(403).json({ message: "Only hospital operations can edit wards." });
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
  io.emit("ward-capacity", { ward: { id: ward.id, name: ward.name, available: ward.available, capacity: ward.capacity }, at: new Date().toISOString() });
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
      ["Estimated fee", `GHS ${wardFee(item, db)} (invoiced when the bed is accepted)`],
    ],
  });
  writeDb(db);
  res.status(201).json(enrichBooking(db, item));
});

app.patch("/api/ward-bookings/:id", async (req, res) => {
  const db = readDb();
  const item = db.wardBookings.find((w) => w.id === req.params.id);
  if (!item) return res.status(404).json({ message: "Ward booking not found" });
  const actor = req.authUser;
  if (actor?.role === "patient" && item.patientId !== actor.id) return res.status(403).json({ message: "That ward request is not on your patient file." });
  if (!actor || !["patient", "doctor", "admin"].includes(actor.role)) return res.status(403).json({ message: "You cannot update this ward request." });
  const prev = item.status;
  if (actor.role === "patient") {
    if (req.body.status && req.body.status !== "cancelled") return res.status(403).json({ message: "Patients can only cancel a ward request; hospital staff confirm beds." });
    if (req.body.status) item.status = req.body.status;
  } else {
    ["status", "ward", "roomType", "date", "nights", "notes"].forEach((key) => { if (req.body[key] !== undefined) item[key] = req.body[key]; });
  }
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
      const fee = wardFee(db, item);
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
        ...(accepted ? [["Admission fee", `GHS ${wardFee(item, db)} — pay by NHIS, MoMo, GCB, or cash`]] : []),
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
  const roomMembers = String(req.params.roomId || "").split("-");
  if (req.authUser?.role !== "admin" && !roomMembers.includes(req.authUser?.id)) return res.status(403).json({ message: "You cannot open this conversation." });
  const db = readDb();
  const userId = req.authUser.id;
  if (userId && markRoomRead(db, userId, req.params.roomId)) {
    writeDb(db);
    io.to(userId).emit("badges-updated", { messages: unreadMessages(db, userId) });
  }
  res.json(db.messages.filter((m) => m.roomId === req.params.roomId));
});

app.patch("/api/messages/:roomId/read", (req, res) => {
  const roomMembers = String(req.params.roomId || "").split("-");
  if (req.authUser?.role !== "admin" && !roomMembers.includes(req.authUser?.id)) return res.status(403).json({ message: "You cannot update this conversation." });
  const db = readDb();
  const userId = req.authUser.id;
  if (userId && markRoomRead(db, userId, req.params.roomId)) writeDb(db);
  const messages = unreadMessages(db, userId);
  io.to(userId).emit("badges-updated", { messages });
  res.json({ ok: true, messages });
});

app.get("/api/badges", (req, res) => {
  const db = readDb();
  const { userId, role } = req.query;
  const appointments = (db.appointments || []).filter((a) => {
    if (role === "patient") return a.patientId === userId;
    if (role === "doctor") return a.doctorId === userId;
    return true;
  });
  const wards = (db.wardBookings || []).filter((w) => {
    if (role === "patient") return w.patientId === userId;
    if (role === "doctor") return true;
    return true;
  });
  const tickets = (db.tickets || []).filter((t) => {
    if (role === "admin") return true;
    return t.userId === userId;
  });
  const queue = (db.pharmacyOrders || []).filter((o) => o.fulfill === "hospital" && o.status === "queued");
  res.json({
    messages: unreadMessages(db, userId),
    visits: appointments.filter(isUpcomingAppt).length,
    wards: wards.filter((w) => w.status === "pending").length,
    tickets: tickets.filter((t) => t.status !== "resolved").length,
    queue: queue.length,
    notifications: (db.notifications || []).filter((n) => n.userId === userId && !n.read).length,
  });
});

app.get("/api/notifications/:userId", (req, res) => {
  if (req.authUser.role !== "admin" && req.params.userId !== req.authUser.id) return res.status(403).json({ message: "You cannot read another account's notifications." });
  const db = readDb();
  res.json(db.notifications.filter((n) => n.userId === req.params.userId).reverse());
});

app.patch("/api/notifications/:userId/read", (req, res) => {
  if (req.authUser.role !== "admin" && req.params.userId !== req.authUser.id) return res.status(403).json({ message: "You cannot update another account's notifications." });
  const db = readDb();
  db.notifications.forEach((n) => {
    if (n.userId === req.params.userId) n.read = true;
  });
  writeDb(db);
  io.to(req.params.userId).emit("badges-updated", { notifications: 0 });
  res.json({ ok: true });
});

app.get("/api/emails/:userId", (req, res) => {
  if (req.authUser.role !== "admin" && req.params.userId !== req.authUser.id) return res.status(403).json({ message: "You cannot read another account's email log." });
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

app.use("/api/admin", requireAuth("admin"));

app.get("/api/admin/overview", (_, res) => {
  const db = readDb();
  res.json({
    patients: db.users.filter((u) => u.role === "patient").length,
    doctors: db.users.filter((u) => u.role === "doctor").length,
    nurses: db.users.filter((u) => u.role === "nurse").length,
    admins: db.users.filter((u) => u.role === "admin").length,
    appointments: db.appointments.length,
    pendingAppointments: db.appointments.filter((a) => a.status === "pending").length,
    wardBookings: db.wardBookings.length,
    pendingWards: db.wardBookings.filter((w) => w.status === "pending").length,
    messages: db.messages.length,
    bedsAvailable: (db.wards || []).reduce((sum, w) => sum + Number(w.available || 0), 0),
    openTickets: (db.tickets || []).filter((t) => t.status !== "resolved").length,
    openCases: (db.cases || []).filter((c) => c.status === "open").length,
  });
});

mountClinical(app, { readDb, writeDb, safeUser, notify, emailPatient });
mountFinance(app, { readDb, writeDb, safeUser, notify, emailPatient, io, clearUserCart, removeCartKinds });
mountPharmacy(app, { readDb, writeDb, safeUser, notify, emailPatient, io, addInvoice, removeCartKinds });
mountCart(app, { readDb, writeDb });
mountSupport(app, { readDb, writeDb, safeUser, notify, emailPatient });
mountCases(app, { readDb, writeDb, safeUser });

app.post("/api/contact", (req, res) => {
  const name = String(req.body.name || "").trim();
  const email = String(req.body.email || "").trim();
  const message = String(req.body.message || "").trim();
  if (!name || !email || !message) {
    return res.status(400).json({ message: "Name, email, and message are required." });
  }
  const db = readDb();
  db.contactMessages = db.contactMessages || [];
  db.contactMessages.push({
    id: `cm${Date.now()}`,
    name,
    email,
    phone: String(req.body.phone || "").trim(),
    subject: String(req.body.subject || "").trim() || "Website message",
    message,
    createdAt: new Date().toISOString(),
  });
  writeDb(db);
  res.status(201).json({ ok: true });
});

app.get("/api/admin/users", (_, res) => {
  const db = readDb();
  res.json(db.users.map(safeUser));
});

app.post("/api/admin/users", (req, res) => {
  const missing = requireFields(req.body, ["name", "email", "password", "role"]);
  if (missing.length) return res.status(400).json({ message: "Name, email, password, and role are required." });
  const policy = validatePassword(req.body.password);
  if (!policy.ok) return res.status(400).json({ message: policy.message, passwordPolicy: policy });
  const role = req.body.role;
  if (!["patient", "doctor", "nurse", "admin"].includes(role)) {
    return res.status(400).json({ message: "Role must be patient, doctor, nurse, or admin." });
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
    password: hashPassword(req.body.password),
    avatar: initials(req.body.name),
    photo: "",
    specialty: req.body.specialty || (role === "admin" ? "Hospital Administration" : ""),
    phone: req.body.phone || "",
    city: req.body.city || "",
    about: req.body.about || "",
    status: "active",
    available: role === "doctor" ? true : undefined,
    years: role === "doctor" ? Number(req.body.years || 1) : undefined,
    department: role === "nurse" ? (req.body.department || "Ridge Campus pharmacy") : req.body.department,
    emailAlerts: true,
    alertPrefs: { appointments: true, wards: true, messages: true, account: true },
  };
  const photoErr = applyPhoto(user, req.body.photo);
  if (photoErr) return res.status(400).json({ message: photoErr });
  db.users.push(user);
  audit(db, { actorId: req.authUser.id, action: "user.create", entity: "user", entityId: user.id, detail: `${role} account created` });
  writeDb(db);
  res.status(201).json(safeUser(user));
});

app.patch("/api/admin/users/:id", (req, res) => {
  const db = readDb();
  const user = db.users.find((u) => u.id === req.params.id);
  if (!user) return res.status(404).json({ message: "User not found" });
  ["name", "email", "phone", "city", "about", "specialty", "role", "status", "available", "years"].forEach((key) => {
    if (req.body[key] !== undefined && req.body[key] !== "") user[key] = req.body[key];
  });
  if (req.body.password) {
    const policy = validatePassword(req.body.password);
    if (!policy.ok) return res.status(400).json({ message: policy.message, passwordPolicy: policy });
    user.password = hashPassword(req.body.password);
    revokeAllUserSessions(db, user.id);
    audit(db, { actorId: req.authUser.id, action: "password.admin-reset", entity: "user", entityId: user.id, detail: "Administrator reset password and revoked sessions" });
  }
  const photoErr = applyPhoto(user, req.body.photo);
  if (photoErr) return res.status(400).json({ message: photoErr });
  if (req.body.name) user.avatar = initials(req.body.name);
  writeDb(db);
  res.json(safeUser(user));
});

io.use((socket, next) => {
  const token = String(socket.handshake.auth?.token || "");
  const db = readDb();
  const user = authUserFromRequest(db, { headers: { authorization: token ? `Bearer ${token}` : "", "user-agent": socket.handshake.headers?.["user-agent"] || "" } });
  if (!user) return next(new Error("Unauthorized socket connection"));
  socket.data.user = user;
  return next();
});

io.on("connection", (socket) => {
  const signedInUser = socket.data.user;
  const roomAllowed = (roomId) => String(roomId || "").split("-").includes(signedInUser.id);
  socket.on("join-user", (userId) => { if (userId === signedInUser.id) socket.join(userId); });
  socket.on("join-room", (roomId) => { if (roomAllowed(roomId)) socket.join(roomId); });

  socket.on("chat-message", async (incoming) => {
    const roomId = String(incoming?.roomId || "");
    if (!roomAllowed(roomId)) return;
    const message = { ...incoming, roomId, senderId: signedInUser.id };
    const db = readDb();
    const sender = db.users.find((u) => u.id === signedInUser.id);
    const recipientId = roomId
      .split("-")
      .find((id) => id !== signedInUser.id);
    const recipient = db.users.find((u) => u.id === recipientId);
    const nursePatient = (sender?.role === "nurse" && recipient?.role === "patient")
      || (sender?.role === "patient" && recipient?.role === "nurse");
    if (nursePatient) return;
    if (sender?.role === "nurse" && recipient && !["doctor", "admin"].includes(recipient.role)) return;
    const record = { ...message, id: `m${Date.now()}`, timestamp: new Date().toISOString() };
    db.messages.push(record);
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
    if (recipientId) {
      io.to(recipientId).emit("chat-message", record);
      io.to(recipientId).emit("badges-updated", { messages: unreadMessages(db, recipientId) });
    }
    if (message.senderId) io.to(message.senderId).emit("chat-message", record);
  });

  socket.on("webrtc-offer", ({ roomId, offer }) => { if (roomAllowed(roomId)) socket.to(roomId).emit("webrtc-offer", { offer }); });
  socket.on("webrtc-answer", ({ roomId, answer }) => { if (roomAllowed(roomId)) socket.to(roomId).emit("webrtc-answer", { answer }); });
  socket.on("webrtc-ice", ({ roomId, candidate }) => { if (roomAllowed(roomId)) socket.to(roomId).emit("webrtc-ice", { candidate }); });
});

const dist = path.join(__dirname, "..", "client", "dist");
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get("/{*path}", (_, res) => res.sendFile(path.join(dist, "index.html")));
}

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`CareBridge server running on http://localhost:${PORT}`));

let shuttingDown = false;
const shutdown = (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(JSON.stringify({ level: "info", event: "server_shutdown", signal, at: new Date().toISOString() }));
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
};
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
