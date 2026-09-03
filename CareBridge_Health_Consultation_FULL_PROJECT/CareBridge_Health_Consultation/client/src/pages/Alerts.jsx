import React, { useEffect, useState } from "react";
import { Mail, CalendarDays, BedDouble, MessageCircle, UserRound } from "lucide-react";
import { api } from "../api";
import { useAuth, useToast } from "../state";
import { prettyDate } from "../utils";

const icons = { appointment: CalendarDays, ward: BedDouble, message: MessageCircle, account: UserRound, test: Mail };

export default function Alerts() {
  const { user } = useAuth();
  const { push } = useToast();
  const [emails, setEmails] = useState([]);
  const [filter, setFilter] = useState("all");

  const load = () => {
    const path = user.role === "admin" ? "/admin/emails" : `/emails/${user.id}`;
    api(path).then(setEmails);
  };
  useEffect(load, [user.id, user.role]);

  const test = async () => {
    await api("/emails/test", { method: "POST", body: JSON.stringify({ userId: user.id }) });
    push("Test email sent");
    load();
  };

  const rows = emails.filter((e) => filter === "all" || e.type === filter);

  return (
    <div>
      <div className="page-title">
        <div>
          <span className="eyebrow">{user.role === "admin" ? "Operations" : "Inbox"}</span>
          <h1>{user.role === "admin" ? "Outbound email log" : "Email alerts"}</h1>
          <p>{user.role === "admin" ? "Every patient alert CareBridge has sent." : "Confirmations for scheduled consultations, ward acceptance, and other care updates."}</p>
        </div>
        {user.role === "patient" && <button className="primary-btn" onClick={test}><Mail size={16} /> Send test alert</button>}
      </div>
      <div className="filters">
        {["all", "appointment", "ward", "message", "account", "test"].map((t) => (
          <button key={t} className={filter === t ? "active" : ""} onClick={() => setFilter(t)}>{t[0].toUpperCase() + t.slice(1)}</button>
        ))}
      </div>
      <div className="email-list">
        {rows.length === 0 && <div className="empty"><Mail size={36} /><h3>No email alerts yet</h3><p>Book a visit or reserve a ward to generate one.</p></div>}
        {rows.map((e) => {
          const Icon = icons[e.type] || Mail;
          return (
            <article className="email-card" key={e.id}>
              <div className="stat-icon"><Icon size={18} /></div>
              <div>
                <strong>{e.subject}</strong>
                <p className="muted" style={{ margin: "6px 0" }}>{e.text}</p>
                <small className="muted">To {e.to} · {prettyDate(e.sentAt)}</small>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
                <span className={`status ${e.status}`}>{e.status}</span>
                {e.previewUrl && <a className="ghost-btn" href={e.previewUrl} target="_blank" rel="noreferrer">Open preview</a>}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
