import React, { useEffect, useMemo, useState } from "react";
import {
  BedDouble, CalendarDays, CheckCircle2, ChevronRight, Mail, MessageCircle,
  Search, Sparkles, UserRound, X,
} from "lucide-react";
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
  const [selected, setSelected] = useState(null);
  const [showPreview, setShowPreview] = useState(false);

  const load = () => {
    const path = user.role === "admin" ? "/admin/emails" : `/emails/${user.id}`;
    api(path).then(setEmails);
  };
  useEffect(() => { load(); }, [user.id, user.role]);

  useEffect(() => {
    if (!selected) return undefined;
    const close = (event) => {
      if (event.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [selected]);

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

  const openNotice = (email) => {
    setSelected(email);
    setShowPreview(false);
  };

  return (
    <div className="px-page px-notice-centre">
      <section className="px-notice-hero">
        <div>
          <span className="px-kicker"><Sparkles size={14} /> {user.role === "admin" ? "Hospital communications" : "Your care feed"}</span>
          <h1>{user.role === "admin" ? "Patient notices" : "Notifications"}</h1>
          <p>{user.role === "admin" ? "A traceable feed of outbound hospital communication." : "Appointments, admissions, messages, billing and support updates in one quiet activity stream."}</p>
        </div>
        <div className="px-notice-stat">
          <span>On file</span>
          <strong>{emails.length}</strong>
          <small>{rows.length} in current view</small>
          {user.role === "patient" && <button className="px-secondary" type="button" onClick={test}><Mail size={15} /> Send test</button>}
        </div>
      </section>

      <section className="px-notice-toolbar">
        <label><Search size={15} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search notifications" /></label>
        <div className="px-segmented">{["all", "appointment", "ward", "message", "account", "support", "test"].map((item) => <button key={item} type="button" className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item}</button>)}</div>
      </section>

      <section className="px-notice-stream">
        {rows.length === 0 && <div className="px-empty"><Mail size={28} /><h3>No notifications in this view</h3><p>New hospital activity will appear here.</p></div>}
        {rows.map((email) => {
          const Icon = icons[email.type] || Mail;
          return (
            <article
              className="px-notice-row px-notice-row-openable"
              key={email.id}
              role="button"
              tabIndex={0}
              onClick={() => openNotice(email)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openNotice(email);
                }
              }}
            >
              <div className="px-notice-time"><span>{prettyDate(email.sentAt)}</span><i /></div>
              <div className="px-notice-icon"><Icon size={17} /></div>
              <div className="px-notice-copy">
                <span className="px-kicker">{email.type || "notice"}</span>
                <h3>{email.subject}</h3>
                <p>{email.text}</p>
                <small>To {email.to}</small>
              </div>
              <div className="px-notice-state">
                <span className={`status ${email.status}`}>{email.status}</span>
                <span className="px-notice-open-label">View <ChevronRight size={15} /></span>
              </div>
            </article>
          );
        })}
      </section>

      {selected && (
        <div className="px-notice-detail-backdrop" role="presentation" onMouseDown={() => setSelected(null)}>
          <aside
            className="px-notice-detail"
            role="dialog"
            aria-modal="true"
            aria-label={selected.subject || "Notification details"}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="px-notice-detail-head">
              <div className="px-notice-detail-icon">
                {React.createElement(icons[selected.type] || Mail, { size: 22 })}
              </div>
              <div>
                <span className="px-kicker">{selected.type || "notice"}</span>
                <h2>{selected.subject || "Hospital notification"}</h2>
                <p>{prettyDate(selected.sentAt)}</p>
              </div>
              <button type="button" onClick={() => setSelected(null)} aria-label="Close notification"><X size={20} /></button>
            </header>

            <div className="px-notice-detail-body">
              <div className="px-notice-detail-status">
                <span><CheckCircle2 size={16} /> {selected.status || "sent"}</span>
                <span>To {selected.to || "your CareBridge account"}</span>
              </div>

              <section className="px-notice-message-sheet">
                <span>Message</span>
                <p>{selected.text || "No additional message content was included."}</p>
              </section>

              {selected.previewUrl && (
                <section className="px-notice-preview-section">
                  <div>
                    <div>
                      <strong>Rendered email</strong>
                      <small>View the formatted hospital message without leaving this page.</small>
                    </div>
                    <button type="button" className="px-secondary" onClick={() => setShowPreview((value) => !value)}>
                      {showPreview ? "Hide preview" : "Show preview"}
                    </button>
                  </div>
                  {showPreview && (
                    <div className="px-notice-preview-frame">
                      <iframe src={selected.previewUrl} title={`${selected.subject || "Notification"} preview`} />
                    </div>
                  )}
                </section>
              )}
            </div>

            <footer className="px-notice-detail-footer">
              <small>Press Esc or click outside this panel to close.</small>
              <button type="button" className="px-primary" onClick={() => setSelected(null)}>Done</button>
            </footer>
          </aside>
        </div>
      )}
    </div>
  );
}
