import React, { useEffect, useState } from "react";
import { LifeBuoy, Send } from "lucide-react";
import { api } from "../api";
import { useAuth, useToast } from "../state";
import { prettyDate } from "../utils";

const CATEGORIES = [
  { id: "billing", label: "Billing & receipts" },
  { id: "clinical", label: "Clinical / visit" },
  { id: "admissions", label: "Admissions / wards" },
  { id: "technical", label: "Video or sign-in" },
  { id: "account", label: "My account" },
  { id: "other", label: "Other" },
];

export default function Support() {
  const { user } = useAuth();
  const { push } = useToast();
  const isAdmin = user.role === "admin";
  const [tickets, setTickets] = useState([]);
  const [active, setActive] = useState(null);
  const [filter, setFilter] = useState("open");
  const [form, setForm] = useState({ category: "billing", subject: "", body: "" });
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async (keepId) => {
    const rows = await api(`/tickets?userId=${user.id}&role=${user.role}`);
    const list = filter === "open"
      ? rows.filter((t) => t.status !== "resolved")
      : filter === "all"
        ? rows
        : rows.filter((t) => t.status === filter);
    setTickets(list);
    const id = keepId || active?.id;
    setActive(list.find((t) => t.id === id) || list[0] || null);
  };

  useEffect(() => { load(); }, [user.id, user.role, filter]);

  const openTicket = async (id) => {
    const t = await api(`/tickets/${id}?userId=${user.id}&role=${user.role}`);
    setActive(t);
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const t = await api("/tickets", {
        method: "POST",
        body: JSON.stringify({ userId: user.id, ...form }),
      });
      push("Sent to hospital operations. You will see their reply on this thread.");
      setForm({ category: "billing", subject: "", body: "" });
      setFilter("open");
      const rows = await api(`/tickets?userId=${user.id}&role=${user.role}`);
      setTickets(rows.filter((x) => x.status !== "resolved"));
      setActive(t);
    } catch (err) {
      push(err.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const sendReply = async (e) => {
    e.preventDefault();
    if (!active || !reply.trim()) return;
    setBusy(true);
    try {
      const t = await api(`/tickets/${active.id}/replies`, {
        method: "POST",
        body: JSON.stringify({ actorId: user.id, body: reply }),
      });
      setReply("");
      setActive(t);
      push(isAdmin ? "Reply delivered to the requester." : "Reply sent to operations.");
      load(t.id);
    } catch (err) {
      push(err.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (status) => {
    if (!active) return;
    try {
      const t = await api(`/tickets/${active.id}`, {
        method: "PATCH",
        body: JSON.stringify({ actorId: user.id, status }),
      });
      setActive(t);
      push(status === "resolved" ? "Ticket closed." : "Ticket reopened.");
      load(t.id);
    } catch (err) {
      push(err.message, "error");
    }
  };

  return (
    <div>
      <div className="page-title">
        <div>
          <span className="eyebrow">{isAdmin ? "Operations" : "Help desk"}</span>
          <h1>{isAdmin ? "Support desk" : "Help & support"}</h1>
          <p>
            {isAdmin
              ? "Tickets from patients and clinicians land here and as a notice on every administrator account. Replies email the requester."
              : "Write to Ridge Campus operations. Every ticket notifies administrators in CareBridge and by email — this is not a static FAQ."}
          </p>
        </div>
      </div>

      <div className="filters">
        {["open", "in_progress", "resolved", "all"].map((s) => (
          <button key={s} className={filter === s ? "active" : ""} onClick={() => setFilter(s)}>
            {s === "in_progress" ? "In progress" : s[0].toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      <div className="support-layout">
        <section className="card">
          {!isAdmin && (
            <form className="pay-form" onSubmit={submit} style={{ marginBottom: 18 }}>
              <h3><LifeBuoy size={16} /> New request</h3>
              <label>Category
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </label>
              <label>Subject<input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} required placeholder="e.g. MoMo receipt not showing" /></label>
              <label>How can we help?<textarea rows="4" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} required /></label>
              <button className="primary-btn" disabled={busy}>{busy ? "Sending…" : "Send to operations"}</button>
            </form>
          )}
          <h3>{isAdmin ? "Queue" : "Your tickets"}</h3>
          {tickets.length === 0 && <p className="muted">{filter === "open" ? "No open tickets." : "Nothing in this view."}</p>}
          {tickets.map((t) => (
            <button type="button" key={t.id} className={`pay-pick ${active?.id === t.id ? "on" : ""}`} onClick={() => openTicket(t.id)}>
              <span>
                <b>{t.subject}</b>
                <small>{isAdmin ? `${t.user?.name || "Unknown"} · ` : ""}{t.category} · {prettyDate(t.updatedAt || t.createdAt)}</small>
              </span>
              <strong className={`status ${t.status === "resolved" ? "completed" : t.status === "open" ? "pending" : "confirmed"}`}>{t.status.replace("_", " ")}</strong>
            </button>
          ))}
        </section>

        <section className="card">
          {!active && <p className="muted">{isAdmin ? "Select a ticket to reply. Replies notify the sender." : "Open a ticket or send a new request."}</p>}
          {active && (
            <div className="ticket-thread">
              <div className="card-head">
                <div>
                  <span className="eyebrow">{active.category}</span>
                  <h3>{active.subject}</h3>
                  <p className="muted">{active.user?.name} · {active.user?.email}</p>
                </div>
                {active.status !== "resolved" ? (
                  <button className="secondary-btn" type="button" onClick={() => setStatus("resolved")}>Mark resolved</button>
                ) : (
                  <button className="ghost-btn" type="button" onClick={() => setStatus("open")}>Reopen</button>
                )}
              </div>
              <article className="ticket-msg">
                <b>{active.user?.name}</b>
                <small>{prettyDate(active.createdAt)}</small>
                <p>{active.body}</p>
              </article>
              {(active.replies || []).map((r) => (
                <article className={`ticket-msg ${r.role === "admin" ? "ops" : ""}`} key={r.id}>
                  <b>{r.authorName} {r.role === "admin" ? "· Operations" : ""}</b>
                  <small>{prettyDate(r.createdAt)}</small>
                  <p>{r.body}</p>
                </article>
              ))}
              {active.status !== "resolved" && (
                <form className="ticket-reply" onSubmit={sendReply}>
                  <textarea rows="3" value={reply} onChange={(e) => setReply(e.target.value)} placeholder={isAdmin ? "Reply to the requester…" : "Add more detail for operations…"} required />
                  <button className="primary-btn" disabled={busy}><Send size={16} /> {isAdmin ? "Reply to requester" : "Send update"}</button>
                </form>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
