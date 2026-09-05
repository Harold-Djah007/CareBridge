import React, { useEffect, useState } from "react";
import { Mail, CalendarDays, BedDouble, MessageCircle, UserRound } from "lucide-react";
import { api } from "../api";
import { useAuth, useToast } from "../state";
import { prettyDate } from "../utils";
import PageHero, { EmptyPlate } from "../components/PageHero";

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
  useEffect(() => { load(); }, [user.id, user.role]);

  const test = async () => {
    await api("/emails/test", { method: "POST", body: JSON.stringify({ userId: user.id }) });
    push("Test email sent");
    load();
  };

  const rows = emails.filter((e) => filter === "all" || e.type === filter);

  return (
    <div>
      <PageHero
        scene="alerts"
        eyebrow={user.role === "admin" ? "Audit" : "Hospital notices"}
        title={user.role === "admin" ? "Outbound patient notices" : "Your notifications"}
        lead={user.role === "admin" ? "Every confirmation the hospital has emailed." : "Visit confirmations, bed decisions, and messages from your doctors."}
        actions={user.role === "patient" ? <button className="primary-btn" onClick={test}><Mail size={16} /> Send test alert</button> : null}
      />
      <div className="filters">
        {["all", "appointment", "ward", "message", "account", "support", "test"].map((t) => (
          <button key={t} className={filter === t ? "active" : ""} onClick={() => setFilter(t)}>{t[0].toUpperCase() + t.slice(1)}</button>
        ))}
      </div>
      <div className="email-list">
        {rows.length === 0 && <EmptyPlate scene="alerts" icon={Mail} title="No email alerts yet" hint="Book a visit or reserve a ward to generate one." />}
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
