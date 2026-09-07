import React, { useEffect, useMemo, useState } from "react";
import { BedDouble, CalendarDays, Mail, MessageCircle, Search, Sparkles, UserRound } from "lucide-react";
import { api } from "../api";
import { useAuth, useToast } from "../state";
import { prettyDate } from "../utils";

const icons = { appointment: CalendarDays, ward: BedDouble, message: MessageCircle, account: UserRound, test: Mail, support: Mail };

export default function Alerts() {
  const { user } = useAuth();
  const { push } = useToast();
  const [emails, setEmails] = useState([]);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");

  const load = () => {
    const path = user.role === "admin" ? "/admin/emails" : `/emails/${user.id}`;
    api(path).then(setEmails);
  };
  useEffect(() => { load(); }, [user.id, user.role]);

  const test = async () => {
    await api("/emails/test", { method: "POST", body: JSON.stringify({ userId: user.id }) });
    push("Test notice sent");
    load();
  };

  const rows = useMemo(() => emails.filter((email) => {
    if (filter !== "all" && email.type !== filter) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return `${email.subject || ""} ${email.text || ""} ${email.to || ""}`.toLowerCase().includes(q);
  }), [emails, filter, query]);

  return (
    <div className="px-page px-notice-centre">
      <section className="px-notice-hero">
        <div><span className="px-kicker"><Sparkles size={14} /> {user.role === "admin" ? "Hospital communications" : "Your care feed"}</span><h1>{user.role === "admin" ? "Patient notices" : "Notifications"}</h1><p>{user.role === "admin" ? "A traceable feed of outbound hospital communication." : "Appointments, admissions, messages, billing and support updates in one quiet activity stream."}</p></div>
        <div className="px-notice-stat"><span>On file</span><strong>{emails.length}</strong><small>{rows.length} in current view</small>{user.role === "patient" && <button className="px-secondary" type="button" onClick={test}><Mail size={15} /> Send test</button>}</div>
      </section>

      <section className="px-notice-toolbar">
        <label><Search size={15} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search notifications" /></label>
        <div className="px-segmented">{["all", "appointment", "ward", "message", "account", "support", "test"].map((item) => <button key={item} type="button" className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item}</button>)}</div>
      </section>

      <section className="px-notice-stream">
        {rows.length === 0 && <div className="px-empty"><Mail size={28} /><h3>No notifications in this view</h3><p>New hospital activity will appear here.</p></div>}
        {rows.map((email, index) => {
          const Icon = icons[email.type] || Mail;
          return <article className="px-notice-row" key={email.id}>
            <div className="px-notice-time"><span>{prettyDate(email.sentAt)}</span><i /></div>
            <div className="px-notice-icon"><Icon size={17} /></div>
            <div className="px-notice-copy"><span className="px-kicker">{email.type || "notice"}</span><h3>{email.subject}</h3><p>{email.text}</p><small>To {email.to}</small></div>
            <div className="px-notice-state"><span className={`status ${email.status}`}>{email.status}</span>{email.previewUrl && <a href={email.previewUrl} target="_blank" rel="noreferrer">Open preview</a>}</div>
          </article>;
        })}
      </section>
    </div>
  );
}
