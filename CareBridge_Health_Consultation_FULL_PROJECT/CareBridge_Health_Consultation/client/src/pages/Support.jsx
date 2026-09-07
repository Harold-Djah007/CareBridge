import React, { useEffect, useState } from "react";
import { LifeBuoy, Search, Send, ShieldCheck, Sparkles, XCircle } from "lucide-react";
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
  const [query, setQuery] = useState("");
  const [compose, setCompose] = useState(false);
  const [form, setForm] = useState({ category: "billing", subject: "", body: "" });
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async (keepId) => {
    const rows = await api(`/tickets?userId=${user.id}&role=${user.role}`);
    const list = filter === "open" ? rows.filter((ticket) => ticket.status !== "resolved") : filter === "all" ? rows : rows.filter((ticket) => ticket.status === filter);
    setTickets(list);
    const id = keepId || active?.id;
    setActive(list.find((ticket) => ticket.id === id) || list[0] || null);
  };

  useEffect(() => { load(); }, [user.id, user.role, filter]);

  const openTicket = async (id) => setActive(await api(`/tickets/${id}?userId=${user.id}&role=${user.role}`));

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      const ticket = await api("/tickets", { method: "POST", body: JSON.stringify({ userId: user.id, ...form }) });
      setForm({ category: "billing", subject: "", body: "" });
      setCompose(false);
      setFilter("open");
      push("Request sent to hospital operations.");
      const rows = await api(`/tickets?userId=${user.id}&role=${user.role}`);
      setTickets(rows.filter((item) => item.status !== "resolved"));
      setActive(ticket);
    } catch (err) { push(err.message, "error"); } finally { setBusy(false); }
  };

  const sendReply = async (event) => {
    event.preventDefault();
    if (!active || !reply.trim()) return;
    setBusy(true);
    try {
      const ticket = await api(`/tickets/${active.id}/replies`, { method: "POST", body: JSON.stringify({ actorId: user.id, body: reply }) });
      setReply("");
      setActive(ticket);
      push(isAdmin ? "Reply delivered to requester." : "Update sent to operations.");
      load(ticket.id);
    } catch (err) { push(err.message, "error"); } finally { setBusy(false); }
  };

  const setStatus = async (status) => {
    if (!active) return;
    const ticket = await api(`/tickets/${active.id}`, { method: "PATCH", body: JSON.stringify({ actorId: user.id, status }) });
    setActive(ticket);
    push(status === "resolved" ? "Ticket resolved." : "Ticket reopened.");
    load(ticket.id);
  };

  const visible = tickets.filter((ticket) => `${ticket.subject} ${ticket.category} ${ticket.user?.name || ""}`.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <div className="px-page px-support-desk">
      <section className="px-support-hero">
        <div><span className="px-kicker"><Sparkles size={14} /> {isAdmin ? "Hospital operations" : "CareBridge support"}</span><h1>{isAdmin ? "Service desk" : "Support that stays in context."}</h1><p>{isAdmin ? "Triage patient and staff requests, reply with traceability and close the loop from one operational queue." : "Billing, visits, admissions, video and account help all live in one threaded service experience."}</p></div>
        <div className="px-support-summary"><span>Open requests</span><strong>{tickets.filter((ticket) => ticket.status !== "resolved").length}</strong><small>{isAdmin ? "operations queue" : "on your account"}</small>{!isAdmin && <button className="px-primary" type="button" onClick={() => setCompose(true)}><LifeBuoy size={16} /> New request</button>}</div>
      </section>

      <section className="px-support-shell">
        <aside className="px-ticket-rail">
          <header><div><span className="px-kicker">Tickets</span><h2>{visible.length}</h2></div><div className="px-segmented">{["open","in_progress","resolved","all"].map((item) => <button type="button" key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item === "in_progress" ? "working" : item}</button>)}</div></header>
          <label className="px-ticket-search"><Search size={15} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search tickets" /></label>
          <div className="px-ticket-list">{visible.map((ticket) => <button type="button" key={ticket.id} className={active?.id === ticket.id ? "active" : ""} onClick={() => openTicket(ticket.id)}><span><strong>{ticket.subject}</strong><small>{isAdmin ? `${ticket.user?.name || "Unknown"} · ` : ""}{ticket.category}</small></span><em className={`status ${ticket.status === "resolved" ? "completed" : ticket.status === "open" ? "pending" : "confirmed"}`}>{ticket.status.replace("_", " ")}</em><time>{prettyDate(ticket.updatedAt || ticket.createdAt)}</time></button>)}{visible.length === 0 && <div className="px-empty compact"><LifeBuoy size={24} /><h3>No tickets here</h3></div>}</div>
        </aside>

        <main className="px-ticket-thread">
          {!active ? <div className="px-empty large"><LifeBuoy size={30} /><h3>{isAdmin ? "Choose a request" : "No ticket selected"}</h3><p>{isAdmin ? "Open a ticket from the queue to respond." : "Start a request when you need help."}</p></div> : <>
            <header className="px-ticket-head"><div><span className="px-kicker">{active.category}</span><h2>{active.subject}</h2><p>{active.user?.name} · {active.user?.email}</p></div>{active.status !== "resolved" ? <button type="button" onClick={() => setStatus("resolved")}>Mark resolved</button> : <button type="button" onClick={() => setStatus("open")}>Reopen</button>}</header>
            <div className="px-ticket-messages"><article className="px-ticket-message requester"><header><strong>{active.user?.name}</strong><time>{prettyDate(active.createdAt)}</time></header><p>{active.body}</p></article>{(active.replies || []).map((item) => <article className={`px-ticket-message ${item.role === "admin" ? "operations" : "requester"}`} key={item.id}><header><strong>{item.authorName}{item.role === "admin" ? " · Operations" : ""}</strong><time>{prettyDate(item.createdAt)}</time></header><p>{item.body}</p></article>)}</div>
            {active.status !== "resolved" && <form className="px-ticket-composer" onSubmit={sendReply}><textarea rows="3" value={reply} onChange={(e) => setReply(e.target.value)} placeholder={isAdmin ? "Reply to requester…" : "Add more detail…"} required /><button className="px-primary" disabled={busy}><Send size={16} /> {isAdmin ? "Send reply" : "Send update"}</button></form>}
          </>}
        </main>
      </section>

      <div className="px-support-trust"><ShieldCheck size={16} /><span>Support conversations stay attached to authenticated CareBridge identities and ticket history.</span></div>

      {compose && <div className="px-modal-backdrop" onMouseDown={() => setCompose(false)}><form className="px-booking-sheet px-support-sheet" onSubmit={submit} onMouseDown={(e) => e.stopPropagation()}><header><span className="px-sheet-icon"><LifeBuoy size={20} /></span><div><span className="px-kicker">New request</span><h2>How can we help?</h2><p>Tell hospital operations what happened and keep the request attached to your account.</p></div><button type="button" onClick={() => setCompose(false)}><XCircle size={20} /></button></header><div className="px-sheet-body"><label>Category<select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{CATEGORIES.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}</select></label><label>Subject<input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} required placeholder="e.g. MoMo receipt not showing" /></label><label>What happened?<textarea rows="6" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} required /></label></div><footer><button className="px-secondary" type="button" onClick={() => setCompose(false)}>Cancel</button><button className="px-primary" disabled={busy}>Send to operations</button></footer></form></div>}
    </div>
  );
}
