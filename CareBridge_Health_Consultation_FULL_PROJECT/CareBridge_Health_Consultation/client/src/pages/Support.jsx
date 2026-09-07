import React, { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, Inbox, LifeBuoy, Send } from "lucide-react";
import { api } from "../api";
import { useAuth, useToast } from "../state";
import { prettyDate } from "../utils";
import PageHero from "../components/PageHero";

const CATEGORIES = [
  { id: "billing", label: "Billing & receipts" }, { id: "clinical", label: "Clinical / visit" },
  { id: "admissions", label: "Admissions / wards" }, { id: "technical", label: "Video or sign-in" },
  { id: "account", label: "My account" }, { id: "other", label: "Other" },
];

export default function Support() {
  const { user } = useAuth();
  const { push } = useToast();
  const isAdmin = user.role === "admin";
  const [tickets, setTickets] = useState([]);
  const [allTickets, setAllTickets] = useState([]);
  const [active, setActive] = useState(null);
  const [filter, setFilter] = useState("open");
  const [form, setForm] = useState({ category: "billing", subject: "", body: "" });
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async (keepId) => {
    const rows = await api(`/tickets?userId=${user.id}&role=${user.role}`);
    setAllTickets(rows);
    const list = filter === "open" ? rows.filter((t) => t.status !== "resolved") : filter === "all" ? rows : rows.filter((t) => t.status === filter);
    setTickets(list);
    const id = keepId || active?.id;
    setActive(list.find((t) => t.id === id) || list[0] || null);
  };
  useEffect(() => { load(); }, [user.id, user.role, filter]);
  const counts = useMemo(() => ({ open: allTickets.filter((t) => t.status === "open").length, in_progress: allTickets.filter((t) => t.status === "in_progress").length, resolved: allTickets.filter((t) => t.status === "resolved").length }), [allTickets]);

  const openTicket = async (id) => setActive(await api(`/tickets/${id}?userId=${user.id}&role=${user.role}`));
  const submit = async (e) => { e.preventDefault(); setBusy(true); try { const t = await api("/tickets", { method: "POST", body: JSON.stringify({ userId: user.id, ...form }) }); push("Sent to hospital operations. You will see their reply here."); setForm({ category: "billing", subject: "", body: "" }); setFilter("open"); setActive(t); await load(t.id); } catch (err) { push(err.message, "error"); } finally { setBusy(false); } };
  const sendReply = async (e) => { e.preventDefault(); if (!active || !reply.trim()) return; setBusy(true); try { const t = await api(`/tickets/${active.id}/replies`, { method: "POST", body: JSON.stringify({ actorId: user.id, body: reply }) }); setReply(""); setActive(t); push(isAdmin ? "Reply delivered to the requester." : "Reply sent to operations."); load(t.id); } catch (err) { push(err.message, "error"); } finally { setBusy(false); } };
  const setStatus = async (status) => { if (!active) return; try { const t = await api(`/tickets/${active.id}`, { method: "PATCH", body: JSON.stringify({ actorId: user.id, status }) }); setActive(t); push(status === "resolved" ? "Ticket closed." : "Ticket reopened."); load(t.id); } catch (err) { push(err.message, "error"); } };

  return (
    <div className="support-os">
      <PageHero scene="support" eyebrow={isAdmin ? "Hospital support desk" : "CareBridge support"} title={isAdmin ? "Service desk" : "Help & support"} lead={isAdmin ? "Operate the hospital support queue, respond to patients and clinicians, and close issues with a visible audit trail." : "Contact Ridge Campus operations through a tracked service request instead of a static help form."} />

      <section className="ops-metric-grid support-kpis">
        <article className="ops-metric"><span className="ops-metric-icon amber"><Inbox size={17} /></span><div><small>Open</small><strong>{counts.open}</strong><em>Awaiting action</em></div></article>
        <article className="ops-metric"><span className="ops-metric-icon blue"><Clock3 size={17} /></span><div><small>In progress</small><strong>{counts.in_progress}</strong><em>Being handled</em></div></article>
        <article className="ops-metric"><span className="ops-metric-icon green"><CheckCircle2 size={17} /></span><div><small>Resolved</small><strong>{counts.resolved}</strong><em>Closed requests</em></div></article>
        <article className="ops-metric"><span className="ops-metric-icon"><LifeBuoy size={17} /></span><div><small>Total requests</small><strong>{allTickets.length}</strong><em>{isAdmin ? "Hospital queue" : "Your history"}</em></div></article>
      </section>

      <section className="support-console">
        <aside className="support-queue product-section">
          <div className="support-queue-head"><div><span className="eyebrow">{isAdmin ? "Queue" : "Requests"}</span><h3>{isAdmin ? "Support workload" : "Your support history"}</h3></div></div>
          <div className="directory-role-tabs support-filter">{[["open","Open"],["in_progress","In progress"],["resolved","Resolved"],["all","All"]].map(([id,label]) => <button key={id} className={filter === id ? "active" : ""} onClick={() => setFilter(id)}>{label}</button>)}</div>
          <div className="support-ticket-list">
            {tickets.map((t) => <button type="button" key={t.id} className={`support-ticket-row ${active?.id === t.id ? "active" : ""}`} onClick={() => openTicket(t.id)}><span><b>{t.subject}</b><small>{isAdmin ? `${t.user?.name || "Unknown"} · ` : ""}{t.category}</small><em>{prettyDate(t.updatedAt || t.createdAt)}</em></span><strong className={`status ${t.status === "resolved" ? "completed" : t.status === "open" ? "pending" : "confirmed"}`}>{t.status.replace("_", " ")}</strong></button>)}
            {tickets.length === 0 && <div className="product-empty-inline"><LifeBuoy size={18} /><span>No tickets in this view.</span></div>}
          </div>
          {!isAdmin && <form className="support-new-request" onSubmit={submit}><span className="eyebrow">New request</span><h3>Ask hospital operations</h3><label>Category<select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select></label><label>Subject<input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} required placeholder="What do you need help with?" /></label><label>Details<textarea rows="4" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} required /></label><button className="primary-btn" disabled={busy}>{busy ? "Sending…" : "Send request"}</button></form>}
        </aside>

        <section className="support-thread product-section">
          {!active && <div className="support-thread-empty"><LifeBuoy size={30} /><h3>Select a request</h3><p>{isAdmin ? "Choose a ticket from the queue to respond." : "Open a previous request or create a new one."}</p></div>}
          {active && <>
            <div className="support-thread-head"><div><span className="eyebrow">{active.category}</span><h3>{active.subject}</h3><p>{active.user?.name} · {active.user?.email}</p></div><div>{active.status !== "resolved" ? <button className="secondary-btn" type="button" onClick={() => setStatus("resolved")}>Resolve request</button> : <button className="ghost-btn" type="button" onClick={() => setStatus("open")}>Reopen</button>}</div></div>
            <div className="support-conversation"><article className="support-message requester"><div><b>{active.user?.name}</b><small>{prettyDate(active.createdAt)}</small></div><p>{active.body}</p></article>{(active.replies || []).map((r) => <article className={`support-message ${r.role === "admin" ? "operations" : "requester"}`} key={r.id}><div><b>{r.authorName}{r.role === "admin" ? " · Operations" : ""}</b><small>{prettyDate(r.createdAt)}</small></div><p>{r.body}</p></article>)}</div>
            {active.status !== "resolved" && <form className="support-reply" onSubmit={sendReply}><textarea rows="3" value={reply} onChange={(e) => setReply(e.target.value)} placeholder={isAdmin ? "Reply to the requester…" : "Add more information…"} required /><button className="primary-btn" disabled={busy}><Send size={15} /> {isAdmin ? "Send reply" : "Send update"}</button></form>}
          </>}
        </section>
      </section>
    </div>
  );
}
