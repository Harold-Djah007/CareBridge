const ACTIVE_STATUSES = new Set(["pending", "confirmed"]);
const RELEASE_STATUSES = new Set(["declined", "cancelled", "discharged", "completed"]);
const ALLOWED_STATUSES = new Set([...ACTIVE_STATUSES, ...RELEASE_STATUSES]);

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function wardFor(db, name) {
  return (db.wards || []).find((ward) => ward.name === name);
}

function legacyHeldState(item) {
  if (item.capacityHeld !== undefined) return Boolean(item.capacityHeld);
  // Before Premium V6 live capacity, confirmed bookings were the only bookings
  // that reduced availability. Preserve that state for existing records.
  return item.status === "confirmed";
}

function ensureHeldFlag(item) {
  if (item.capacityHeld === undefined) item.capacityHeld = legacyHeldState(item);
  return Boolean(item.capacityHeld);
}

function holdBed(db, item) {
  if (ensureHeldFlag(item)) return wardFor(db, item.ward);
  const ward = wardFor(db, item.ward);
  if (!ward) throw Object.assign(new Error("Ward not found."), { status: 404 });
  const available = Number(ward.available || 0);
  if (available <= 0) throw Object.assign(new Error(`${ward.name} is currently full. Choose another ward.`), { status: 409 });
  const capacity = Math.max(0, Number(ward.capacity || available));
  ward.available = clamp(available - 1, 0, capacity || available);
  item.capacityHeld = true;
  item.bedHeldAt = item.bedHeldAt || new Date().toISOString();
  item.bedReleasedAt = null;
  return ward;
}

function releaseBed(db, item) {
  if (!ensureHeldFlag(item)) return wardFor(db, item.ward);
  const ward = wardFor(db, item.ward);
  if (!ward) {
    item.capacityHeld = false;
    item.bedReleasedAt = new Date().toISOString();
    return null;
  }
  const capacity = Math.max(0, Number(ward.capacity || 0));
  const available = Number(ward.available || 0);
  ward.available = capacity ? clamp(available + 1, 0, capacity) : available + 1;
  item.capacityHeld = false;
  item.bedReleasedAt = new Date().toISOString();
  return ward;
}

function enrichBooking(db, item, safeUser, wardFee) {
  const invoice = (db.invoices || []).find((invoice) => invoice.bookingId === item.id);
  return {
    ...item,
    patient: safeUser(db.users.find((user) => user.id === item.patientId) || {}),
    fee: invoice?.amount ?? wardFee(item, db),
    invoiceId: invoice?.id,
    invoiceStatus: invoice?.status,
  };
}

function emitCapacity(io, db, ward, item) {
  const payload = {
    ward: ward ? { id: ward.id, name: ward.name, available: Number(ward.available || 0), capacity: Number(ward.capacity || 0) } : null,
    booking: item ? { id: item.id, patientId: item.patientId, ward: item.ward, status: item.status, capacityHeld: Boolean(item.capacityHeld) } : null,
    at: new Date().toISOString(),
  };
  if (item?.patientId) io.to(item.patientId).emit("ward-capacity", payload);
  (db.users || [])
    .filter((user) => ["doctor", "admin"].includes(user.role) && user.status !== "inactive")
    .forEach((user) => io.to(user.id).emit("ward-capacity", payload));
}

async function emailOperations(db, emailPatient, item, patient) {
  const admins = (db.users || []).filter((user) => user.role === "admin" && user.status !== "inactive");
  for (const admin of admins) {
    await emailPatient(db, admin.id, {
      type: "ward",
      subject: `New ward reservation · ${item.ward}`,
      heading: "New bed reservation",
      intro: `${patient?.name || "A patient"} reserved a bed and CareBridge has temporarily reduced live availability by one while operations reviews the request.`,
      details: [
        ["Patient", patient?.name || item.patientId],
        ["Ward", item.ward],
        ["Arrival", item.date],
        ["Nights", String(item.nights)],
        ["Status", "Pending review"],
      ],
      closing: "Open Capacity & beds to accept, decline, or later discharge the patient. Released beds are automatically returned to live availability.",
    });
  }
}

export function mountWardAutomation(app, { readDb, writeDb, safeUser, notify, emailPatient, io, wardFee, addInvoice }) {
  // These handlers are mounted before the legacy ward mutation routes in index.js.
  // They intentionally own POST/PATCH booking mutations so capacity is atomic and idempotent.
  app.post("/api/ward-bookings", async (req, res) => {
    const { patientId, ward: wardName, date } = req.body || {};
    if (!String(patientId || "").trim() || !String(wardName || "").trim() || !String(date || "").trim()) {
      return res.status(400).json({ message: "Please choose a ward and admission date." });
    }

    const db = readDb();
    const patient = (db.users || []).find((user) => user.id === patientId);
    if (!patient) return res.status(404).json({ message: "Patient account not found." });

    const item = {
      id: `wb${Date.now()}`,
      patientId,
      ward: wardName,
      roomType: req.body.roomType || "Private Room",
      date,
      nights: Math.max(1, Number(req.body.nights || 1)),
      status: "pending",
      notes: req.body.notes || "",
      capacityHeld: false,
      createdAt: new Date().toISOString(),
    };

    let ward;
    try {
      ward = holdBed(db, item);
    } catch (error) {
      return res.status(error.status || 400).json({ message: error.message });
    }

    db.wardBookings = db.wardBookings || [];
    db.wardBookings.push(item);

    (db.users || []).filter((user) => user.role === "doctor" || user.role === "admin").forEach((user) => {
      notify(db, user.id, "New ward request", `${patient.name} reserved ${item.ward} for ${item.date}. ${ward.available} bed${ward.available === 1 ? "" : "s"} remain.`);
    });
    notify(db, item.patientId, "Bed temporarily reserved", `One ${item.ward} bed is being held for your ${item.date} request while hospital operations reviews it.`);

    await emailPatient(db, item.patientId, {
      type: "ward",
      subject: "Your CareBridge bed reservation is being held",
      heading: "Bed temporarily reserved",
      intro: `We received your ${item.ward} request and temporarily held one bed for you while hospital operations reviews the admission.`,
      details: [
        ["Ward", item.ward],
        ["Room", item.roomType],
        ["Arrival", item.date],
        ["Nights", String(item.nights)],
        ["Status", "Pending review"],
        ["Live availability", `${ward.available} bed${ward.available === 1 ? "" : "s"} remaining`],
        ["Estimated fee", `GHS ${wardFee(item, db)} (invoiced when accepted)`],
      ],
      closing: "If the request is declined or cancelled, the held bed is automatically returned to live availability. You will receive another email when operations updates the request.",
    });
    await emailOperations(db, emailPatient, item, patient);

    writeDb(db);
    emitCapacity(io, db, ward, item);
    res.status(201).json(enrichBooking(db, item, safeUser, wardFee));
  });

  app.patch("/api/ward-bookings/:id", async (req, res) => {
    const db = readDb();
    const item = (db.wardBookings || []).find((booking) => booking.id === req.params.id);
    if (!item) return res.status(404).json({ message: "Ward booking not found" });

    ensureHeldFlag(item);
    const actor = req.authUser;
    if (actor?.role === "patient" && item.patientId !== actor.id) return res.status(403).json({ message: "That ward request is not on your patient file." });
    if (!actor || !["patient", "doctor", "admin"].includes(actor.role)) return res.status(403).json({ message: "You cannot update this ward request." });

    const previousStatus = item.status;
    const previousWard = item.ward;
    const requestedStatus = req.body.status;
    if (requestedStatus && !ALLOWED_STATUSES.has(requestedStatus)) {
      return res.status(400).json({ message: "Ward status must be pending, confirmed, declined, cancelled, discharged, or completed." });
    }

    if (actor.role === "patient") {
      if (requestedStatus && requestedStatus !== "cancelled") return res.status(403).json({ message: "Patients can only cancel a ward request; hospital staff confirm and discharge beds." });
      if (requestedStatus) item.status = requestedStatus;
    } else {
      ["status", "ward", "roomType", "date", "nights", "notes"].forEach((key) => {
        if (req.body[key] !== undefined) item[key] = req.body[key];
      });
    }

    let changedWard = null;
    try {
      if (item.ward !== previousWard && item.capacityHeld) {
        item.ward = previousWard;
        releaseBed(db, item);
        item.ward = req.body.ward;
      }

      if (ACTIVE_STATUSES.has(item.status)) changedWard = holdBed(db, item);
      if (RELEASE_STATUSES.has(item.status)) changedWard = releaseBed(db, item);
    } catch (error) {
      return res.status(error.status || 400).json({ message: error.message });
    }

    const statusChanged = requestedStatus && requestedStatus !== previousStatus;
    if (statusChanged) {
      const accepted = item.status === "confirmed";
      const discharged = item.status === "discharged" || item.status === "completed";
      const released = RELEASE_STATUSES.has(item.status);

      notify(
        db,
        item.patientId,
        discharged ? "Ward stay completed" : accepted ? "Ward reservation accepted" : `Ward booking ${item.status}`,
        discharged
          ? `You have been discharged from ${item.ward}. The bed has returned to hospital availability.`
          : accepted
            ? `Your ${item.ward} bed is confirmed for ${item.date}.`
            : `Your ${item.ward} reservation is now ${item.status}${released ? " and the held bed has been released" : ""}.`
      );

      if (accepted) {
        const existingInvoice = (db.invoices || []).find((invoice) => invoice.bookingId === item.id);
        if (!existingInvoice) {
          addInvoice(db, {
            patientId: item.patientId,
            item: `${item.ward} · ${item.roomType} × ${item.nights} night(s)`,
            amount: wardFee(item, db),
            category: "ward",
            bookingId: item.id,
          });
        }
      }

      await emailPatient(db, item.patientId, {
        type: "ward",
        subject: discharged
          ? `Discharge complete · ${item.ward}`
          : accepted
            ? "Your ward reservation has been accepted"
            : `Ward reservation ${item.status}`,
        heading: discharged ? "Discharge complete" : accepted ? "Ward accepted" : `Ward ${item.status}`,
        intro: discharged
          ? `Your ${item.ward} stay is complete. CareBridge has automatically returned the bed to live hospital availability.`
          : accepted
            ? "Your held bed has been accepted by hospital operations and is ready for your planned admission."
            : `Your ward reservation was updated to ${item.status}. ${released ? "The held bed has been returned to live availability." : ""}`,
        details: [
          ["Ward", item.ward],
          ["Room", item.roomType],
          ["Arrival", item.date],
          ["Nights", String(item.nights)],
          ["Status", item.status],
          ...(changedWard ? [["Beds now available", String(changedWard.available)]] : []),
          ...(accepted ? [["Admission fee", `GHS ${wardFee(item, db)} — pay by NHIS, MoMo, bank, or cash`]] : []),
        ],
        closing: discharged
          ? "Your care record remains available in CareBridge. Contact the hospital if you need follow-up support."
          : accepted
            ? "Bring your ID and any recent lab results. Message your care team if your arrival time changes."
            : "If you still need a bed, you can make a new reservation from Admissions.",
      });
    }

    writeDb(db);
    emitCapacity(io, db, changedWard || wardFor(db, item.ward), item);
    res.json(enrichBooking(db, item, safeUser, wardFee));
  });
}
