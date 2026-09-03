const nid = (p) => `${p}${Date.now()}${Math.floor(Math.random() * 900)}`;

const CATEGORIES = ["billing", "clinical", "technical", "account", "admissions", "other"];

function enrich(db, ticket, safeUser) {
  const owner = db.users.find((u) => u.id === ticket.userId) || {};
  return {
    ...ticket,
    user: safeUser(owner),
    replyCount: (ticket.replies || []).length,
  };
}

async function pingAdmins(db, { notify, emailPatient }, { title, body, email }) {
  const admins = db.users.filter((u) => u.role === "admin" && u.status !== "inactive");
  for (const admin of admins) {
    notify(db, admin.id, title, body);
    if (email) await emailPatient(db, admin.id, email);
  }
}

export function mountSupport(app, { readDb, writeDb, safeUser, notify, emailPatient }) {
  app.get("/api/tickets", (req, res) => {
    const db = readDb();
    const { userId, role } = req.query;
    let rows = db.tickets || [];
    if (role !== "admin") rows = rows.filter((t) => t.userId === userId);
    const status = req.query.status;
    if (status && status !== "all") rows = rows.filter((t) => t.status === status);
    res.json(rows.slice().reverse().map((t) => enrich(db, t, safeUser)));
  });

  app.get("/api/tickets/:id", (req, res) => {
    const db = readDb();
    const ticket = (db.tickets || []).find((t) => t.id === req.params.id);
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });
    const { userId, role } = req.query;
    if (role !== "admin" && ticket.userId !== userId) {
      return res.status(403).json({ message: "You cannot open this ticket." });
    }
    res.json(enrich(db, ticket, safeUser));
  });

  app.post("/api/tickets", async (req, res) => {
    const subject = String(req.body.subject || "").trim();
    const body = String(req.body.body || "").trim();
    const userId = req.body.userId;
    if (!userId || !subject || !body) {
      return res.status(400).json({ message: "Subject and message are required." });
    }
    const db = readDb();
    const user = db.users.find((u) => u.id === userId);
    if (!user) return res.status(404).json({ message: "Account not found" });
    const category = CATEGORIES.includes(req.body.category) ? req.body.category : "other";
    const ticket = {
      id: nid("tk"),
      userId,
      category,
      subject,
      body,
      status: "open",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      replies: [],
    };
    db.tickets = db.tickets || [];
    db.tickets.push(ticket);
    notify(db, userId, "Support request sent", `Operations has your ticket: ${subject}`);
    await pingAdmins(db, { notify, emailPatient }, {
      title: "New support desk ticket",
      body: `${user.name} · ${category}: ${subject}`,
      email: {
        type: "support",
        subject: `Support desk · ${subject}`,
        heading: "A patient or clinician needs operations",
        intro: `${user.name} opened a help-desk ticket. Reply from Support desk so it reaches their CareBridge inbox and email.`,
        details: [
          ["From", `${user.name} (${user.role})`],
          ["Email", user.email],
          ["Category", category],
          ["Subject", subject],
          ["Message", body.slice(0, 400)],
        ],
        closing: "Open Support desk in Operations to reply. The sender sees your answer on their ticket thread.",
      },
    });
    writeDb(db);
    res.status(201).json(enrich(db, ticket, safeUser));
  });

  app.post("/api/tickets/:id/replies", async (req, res) => {
    const text = String(req.body.body || "").trim();
    if (!text) return res.status(400).json({ message: "Write a reply before sending." });
    const db = readDb();
    const ticket = (db.tickets || []).find((t) => t.id === req.params.id);
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });
    const actor = db.users.find((u) => u.id === req.body.actorId);
    if (!actor) return res.status(404).json({ message: "Account not found" });
    if (actor.role !== "admin" && ticket.userId !== actor.id) {
      return res.status(403).json({ message: "You cannot reply on this ticket." });
    }
    const reply = {
      id: nid("tr"),
      authorId: actor.id,
      authorName: actor.name,
      role: actor.role,
      body: text,
      createdAt: new Date().toISOString(),
    };
    ticket.replies = ticket.replies || [];
    ticket.replies.push(reply);
    ticket.updatedAt = reply.createdAt;
    if (actor.role === "admin" && ticket.status === "open") ticket.status = "in_progress";

    if (actor.role === "admin") {
      notify(db, ticket.userId, "Support desk replied", `${actor.name} answered “${ticket.subject}”.`);
      await emailPatient(db, ticket.userId, {
        type: "support",
        subject: `Support desk reply · ${ticket.subject}`,
        heading: "Operations replied to your ticket",
        intro: `${actor.name} from hospital operations sent an answer on your CareBridge support request.`,
        details: [
          ["Ticket", ticket.subject],
          ["Reply", text.slice(0, 400)],
        ],
        closing: "Open Help & support in CareBridge to continue the thread.",
      });
    } else {
      await pingAdmins(db, { notify, emailPatient }, {
        title: "Support ticket update",
        body: `${actor.name} replied on “${ticket.subject}”.`,
        email: {
          type: "support",
          subject: `Ticket reply · ${ticket.subject}`,
          heading: "The requester wrote back",
          intro: `${actor.name} added a message to an open support ticket.`,
          details: [
            ["From", actor.name],
            ["Ticket", ticket.subject],
            ["Reply", text.slice(0, 400)],
          ],
          closing: "Open Support desk to continue.",
        },
      });
    }
    writeDb(db);
    res.status(201).json(enrich(db, ticket, safeUser));
  });

  app.patch("/api/tickets/:id", async (req, res) => {
    const db = readDb();
    const ticket = (db.tickets || []).find((t) => t.id === req.params.id);
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });
    const actor = db.users.find((u) => u.id === req.body.actorId);
    if (!actor) return res.status(404).json({ message: "Account not found" });
    if (actor.role !== "admin" && ticket.userId !== actor.id) {
      return res.status(403).json({ message: "You cannot update this ticket." });
    }
    const status = req.body.status;
    if (status && !["open", "in_progress", "resolved"].includes(status)) {
      return res.status(400).json({ message: "Status must be open, in progress, or resolved." });
    }
    if (status) ticket.status = status;
    ticket.updatedAt = new Date().toISOString();
    const owner = db.users.find((u) => u.id === ticket.userId) || {};
    if (status === "resolved") {
      notify(db, ticket.userId, "Ticket resolved", `“${ticket.subject}” is closed.`);
      if (actor.role === "admin") {
        await emailPatient(db, ticket.userId, {
          type: "support",
          subject: `Resolved · ${ticket.subject}`,
          heading: "Your support ticket is resolved",
          intro: "Hospital operations marked this request resolved. Re-open it from Help & support if you still need help.",
          details: [["Ticket", ticket.subject]],
        });
      } else {
        await pingAdmins(db, { notify, emailPatient }, {
          title: "Ticket marked resolved",
          body: `${owner.name || actor.name} closed “${ticket.subject}”.`,
        });
      }
    }
    writeDb(db);
    res.json(enrich(db, ticket, safeUser));
  });
}
