import React, { useEffect, useMemo, useState } from "react";
import {
  BedDouble, Bell, CalendarDays, CheckCircle2, ChevronRight, Mail, MessageCircle,
  Search, Sparkles, UserRound,
} from "lucide-react";
import { io } from "socket.io-client";
import { useOutletContext } from "react-router-dom";
import { api, socketOptions, socketUrl } from "../api";
import { useAuth, useToast } from "../state";
import { prettyDate } from "../utils";
import NotificationReader, { inferNotificationType, normalizeNotification } from "../components/NotificationReader";

const icons = { appointment: CalendarDays, ward: BedDouble, message: MessageCircle, account: UserRound, test: Mail, support: Mail, live: Bell };

export default function Alerts() {
  const { user } = useAuth();
  const { push } = useToast();
  const shell = useOutletContext() || {};
  const badges = shell.badges || {};
  const refreshBadges = shell.refreshBadges || (() => Promise.resolve());
  const refreshNotifications = shell.refreshNotifications || (() => Promise.resolve());
  const [emails, setEmails] = useState([]);
  const [liveNotes, setLiveNotes] = useState([]);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [connected, setConnected] = useState(false);

  const load = () => {
    const emailPath = user.role === "admin" ? "/admin/emails" : `/emails/${user.id}`;
    return Promise.all([
      api(emailPath).then(setEmails),
      api(`/notifications/${user.id}`).then(setLiveNotes),
      refreshBadges(),
      refreshNotifications(),
    ]).catch(() => {});
  };

  useEffect(() => {
    load();
    const socket = io(socketUrl, socketOptions());
    socket.emit("join-user", user.id);
    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("notification", load);
    socket.on("email-alert", load);
    socket.on("badges-updated", load);
    socket.on("ward-capacity", load);
    return () => socket.disconnect();
  }, [user.id, user.role]);

  const test = async () => {
    await api("/emails/test", { method: "POST", body: JSON.stringify({ userId: user.id }) });
    push("Test notice sent");
    load();
  };

  const markAllRead = async () => {
    await api(`/notifications/${user.id}/read`, { method: "PATCH" });
    push("Live notifications marked as read.");
    load();
  };

  const rows = useMemo(() => emails.filter((email) => {
    if (filter !== "all" && email.type !== filter) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return `${email.subject || ""} ${email.text || ""} ${email.to || ""}`.toLowerCase().includes(q);
  }), [emails, filter, query]);

  const visibleLive = useMemo(() => {
    const q = query.trim().toLowerCase();
    return liveNotes.filter((note) => {
      const type = inferNotificationType(note);
      if (filter !== "all" && filter !== type) return false;
      if (!q) return true;
      return `${note.title || ""} ${note.body || ""}`.toLowerCase().includes(q);
    });
  }, [liveNotes, filter, query]);

  const openNotice = (email) => {
    setSelected(normalizeNotification(email, user));
    setShowPreview(false);
  };

  const openLive = async (note) => {
    setSelected(normalizeNotification({ ...note, source: "live" }, user));
    setShowPreview(false);
    if (note.read) return;
    try {
      await api(`/notifications/${user.id}/${note.id}/read`, { method: "PATCH" });
      await load();
    } catch {}
  };

  const unread = Number(badges.notifications || 0);

  return (
    <div className="px-page px-notice-centre">
      <section className="px-notice-hero">
        <div>
          <span className="px-kicker"><Sparkles size={14} /> {user.role === "admin" ? "Hospital communications" : "Your care feed"}</span>
          <h1>{user.role === "admin" ? "Patient notices" : "Notifications"}</h1>
          <p>{user.role === "admin" ? "A live operational feed plus traceable outbound email delivery." : "Live care alerts and email delivery history stay synchronized with the badges across CareBridge."}</p>
        </div>
        <div className="px-notice-stat">
          <span>{connected ? "Live unread" : "Reconnecting"}</span>
          <strong>{unread}</strong>
          <small>{liveNotes.length} live alerts · {emails.length} email records</small>
          <div className="px-notice-stat-actions">
            {unread > 0 && <button className="px-secondary" type="button" onClick={markAllRead}><CheckCircle2 size={15} /> Mark read</button>}
            {user.role === "patient" && <button className="px-secondary" type="button" onClick={test}><Mail size={15} /> Send test</button>}
          </div>
        </div>
      </section>

      <section className="px-notice-toolbar">
        <label><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search notifications" /></label>
        <div className="px-segmented">{["all", "appointment", "ward", "message", "account", "support", "test"].map((item) => <button key={item} type="button" className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item}</button>)}</div>
      </section>

      <section className="px-live-alerts">
        <header><div><span className="px-kicker">Live CareBridge activity</span><h2>In-app notifications</h2></div><span className={connected ? "px-live-state on" : "px-live-state"}><i /> {connected ? "Live" : "Syncing"}</span></header>
        <div className="px-live-alert-list">
          {visibleLive.length === 0 && <div className="px-empty compact"><Bell size={24} /><h3>No live alerts in this view</h3></div>}
          {visibleLive.slice(0, 8).map((note) => {
            const type = inferNotificationType(note);
            const Icon = icons[type] || Bell;
            return <button key={note.id} type="button" className={`px-live-alert ${note.read ? "" : "unread"}`} onClick={() => openLive(note)}><span className="px-live-alert-icon"><Icon size={17} /></span><span className="px-live-alert-copy"><strong>{note.title}</strong><small>{note.body}</small></span><span className="px-live-alert-state">{note.read ? "Read" : "New"}<ChevronRight size={14} /></span></button>;
          })}
        </div>
      </section>

      <section className="px-notice-stream">
        <header className="px-email-history-head"><div><span className="px-kicker">Delivery history</span><h2>Email notifications</h2></div><span>{rows.length} shown</span></header>
        {rows.length === 0 && <div className="px-empty"><Mail size={28} /><h3>No email notifications in this view</h3><p>New outbound hospital email will appear here.</p></div>}
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
              <div className="px-notice-time"><span>{prettyDate(email.sentAt || email.queuedAt)}</span><i /></div>
              <div className="px-notice-icon"><Icon size={17} /></div>
              <div className="px-notice-copy">
                <span className="px-kicker">{email.type || "notice"}</span>
                <h3>{email.subject}</h3>
                <p>{email.text}</p>
                <small>To {email.to}</small>
              </div>
              <div className="px-notice-state">
                <span className={`status ${email.status}`}>{String(email.status || "queued").replaceAll("_", " ")}</span>
                <span className="px-notice-open-label">View <ChevronRight size={15} /></span>
              </div>
            </article>
          );
        })}
      </section>

      <NotificationReader
        notice={selected}
        onClose={() => setSelected(null)}
        showPreview={showPreview}
        onTogglePreview={() => setShowPreview((value) => !value)}
      />
    </div>
  );
}
