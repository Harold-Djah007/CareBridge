import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import http from "http";
import { Server } from "socket.io";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, "data", "db.json");

const readDb = () => JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
const writeDb = (db) => fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: ["http://localhost:5173"], methods: ["GET", "POST"] }
});

app.use(cors());
app.use(express.json());

const safeUser = (u) => {
  const { password, ...rest } = u;
  return rest;
};

app.get("/api/health", (_, res) => res.json({ ok: true, name: "CareBridge API" }));

app.post("/api/login", (req, res) => {
  const { email, password } = req.body;
  const db = readDb();
  const user = db.users.find(u => u.email.toLowerCase() === String(email).toLowerCase() && u.password === password);
  if (!user) return res.status(401).json({ message: "Incorrect email or password." });
  res.json({ user: safeUser(user) });
});

app.get("/api/doctors", (_, res) => {
  const db = readDb();
  res.json(db.users.filter(u => u.role === "doctor").map(safeUser));
});

app.get("/api/appointments", (req, res) => {
  const { userId, role } = req.query;
  const db = readDb();
  let rows = db.appointments;
  if (role === "patient") rows = rows.filter(a => a.patientId === userId);
  if (role === "doctor") rows = rows.filter(a => a.doctorId === userId);
  const mapped = rows.map(a => ({
    ...a,
    patient: safeUser(db.users.find(u => u.id === a.patientId) || {}),
    doctor: safeUser(db.users.find(u => u.id === a.doctorId) || {})
  }));
  res.json(mapped);
});

app.post("/api/appointments", (req, res) => {
  const db = readDb();
  const item = {
    id: `a${Date.now()}`,
    patientId: req.body.patientId,
    doctorId: req.body.doctorId,
    date: req.body.date,
    time: req.body.time,
    reason: req.body.reason || "Consultation",
    status: "confirmed",
    mode: req.body.mode || "video"
  };
  db.appointments.push(item);
  db.notifications.push({
    id: `n${Date.now()}`,
    userId: item.doctorId,
    title: "New appointment",
    body: `A patient booked ${item.date} at ${item.time}.`,
    read: false
  });
  writeDb(db);
  io.to(item.doctorId).emit("notification", { title: "New appointment", body: `New booking for ${item.date} at ${item.time}` });
  res.status(201).json(item);
});

app.patch("/api/appointments/:id", (req, res) => {
  const db = readDb();
  const item = db.appointments.find(a => a.id === req.params.id);
  if (!item) return res.status(404).json({ message: "Appointment not found" });
  Object.assign(item, req.body);
  writeDb(db);
  res.json(item);
});

app.get("/api/wards", (_, res) => {
  res.json([
    { id: "general", name: "General Ward", available: 12, description: "General inpatient care and observation." },
    { id: "medical", name: "Medical Ward", available: 7, description: "For adult medical admissions and monitoring." },
    { id: "maternity", name: "Maternity Ward", available: 5, description: "Maternal and post-delivery care." },
    { id: "pediatric", name: "Pediatric Ward", available: 8, description: "Dedicated care for children and adolescents." }
  ]);
});

app.get("/api/ward-bookings", (req, res) => {
  const db = readDb();
  const { userId, role } = req.query;
  let rows = db.wardBookings;
  if (role === "patient") rows = rows.filter(w => w.patientId === userId);
  const mapped = rows.map(w => ({
    ...w,
    patient: safeUser(db.users.find(u => u.id === w.patientId) || {})
  }));
  res.json(mapped);
});

app.post("/api/ward-bookings", (req, res) => {
  const db = readDb();
  const item = {
    id: `w${Date.now()}`,
    patientId: req.body.patientId,
    ward: req.body.ward,
    roomType: req.body.roomType,
    date: req.body.date,
    nights: Number(req.body.nights || 1),
    status: "pending",
    notes: req.body.notes || ""
  };
  db.wardBookings.push(item);
  writeDb(db);
  res.status(201).json(item);
});

app.patch("/api/ward-bookings/:id", (req, res) => {
  const db = readDb();
  const item = db.wardBookings.find(w => w.id === req.params.id);
  if (!item) return res.status(404).json({ message: "Ward booking not found" });
  Object.assign(item, req.body);
  writeDb(db);
  res.json(item);
});

app.get("/api/messages/:roomId", (req, res) => {
  const db = readDb();
  res.json(db.messages.filter(m => m.roomId === req.params.roomId));
});

app.get("/api/notifications/:userId", (req, res) => {
  const db = readDb();
  res.json(db.notifications.filter(n => n.userId === req.params.userId));
});

io.on("connection", (socket) => {
  socket.on("join-user", (userId) => socket.join(userId));
  socket.on("join-room", (roomId) => socket.join(roomId));

  socket.on("chat-message", (message) => {
    const db = readDb();
    const record = { ...message, id: `m${Date.now()}`, timestamp: new Date().toISOString() };
    db.messages.push(record);
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
  app.get("*", (_, res) => res.sendFile(path.join(dist, "index.html")));
}

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`CareBridge server running on http://localhost:${PORT}`));
