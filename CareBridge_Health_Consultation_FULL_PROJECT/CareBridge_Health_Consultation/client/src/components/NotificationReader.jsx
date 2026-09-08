import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  BedDouble, Bell, CalendarDays, CheckCircle2, CreditCard, LifeBuoy,
  Mail, MessageCircle, X,
} from "lucide-react";
import { prettyDate } from "../utils";

const ICONS = {
  appointment: CalendarDays,
  ward: BedDouble,
  message: MessageCircle,
  account: CreditCard,
  support: LifeBuoy,
  test: Mail,
  live: Bell,
};

export function inferNotificationType(note) {
  if (note?.type) return note.type;
  const text = `${note?.title || note?.subject || ""} ${note?.body || note?.text || ""}`.toLowerCase();
  if (text.includes("ward") || text.includes("bed") || text.includes("admission")) return "ward";
  if (text.includes("message") || text.includes("chat")) return "message";
  if (text.includes("appointment") || text.includes("consultation") || text.includes("visit")) return "appointment";
  if (text.includes("support") || text.includes("ticket")) return "support";
  if (text.includes("payment") || text.includes("billing") || text.includes("account") || text.includes("receipt") || text.includes("pharmacy")) return "account";
  return "live";
}

export function normalizeNotification(note, user) {
  const type = inferNotificationType(note);
  return {
    ...note,
    type,
    subject: note?.subject || note?.title || "CareBridge notification",
    text: note?.text || note?.body || "No additional message content was included.",
    sentAt: note?.sentAt || note?.createdAt || note?.queuedAt || "",
    to: note?.to || user?.email || "your CareBridge account",
    status: note?.status || (note?.read ? "read" : "unread"),
    source: note?.source || (note?.body !== undefined && note?.subject === undefined ? "live" : "email"),
  };
}

export default function NotificationReader({ notice, onClose, showPreview = false, onTogglePreview }) {
  const dialogRef = useRef(null);
  const closeRef = useRef(null);

  useEffect(() => {
    if (!notice) return undefined;
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement;
    document.body.style.overflow = "hidden";

    const focusFirst = () => closeRef.current?.focus({ preventScroll: true });
    const frame = window.requestAnimationFrame(focusFirst);
    const onKey = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose?.();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )].filter((element) => element.getClientRects().length > 0);
      if (!focusable.length) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
      if (previousFocus instanceof HTMLElement && document.contains(previousFocus)) {
        window.requestAnimationFrame(() => previousFocus.focus({ preventScroll: true }));
      }
    };
  }, [notice]);

  if (!notice) return null;

  const Icon = ICONS[notice.type] || Bell;
  const dateLabel = notice.sentAt ? prettyDate(notice.sentAt) : "CareBridge activity";
  const titleId = `cb-notification-title-${String(notice.id || "active").replace(/[^A-Za-z0-9_-]/g, "")}`;
  const messageId = `${titleId}-message`;

  return createPortal(
    <div className="cb-notification-portal" role="presentation" onMouseDown={onClose}>
      <aside
        ref={dialogRef}
        className="cb-notification-reader"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        tabIndex="-1"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="cb-notification-reader-head">
          <div className="cb-notification-reader-icon" aria-hidden="true"><Icon size={22} /></div>
          <div className="cb-notification-reader-title">
            <span>{notice.source === "live" ? "Live CareBridge alert" : notice.type || "Notification"}</span>
            <h2 id={titleId}>{notice.subject || "Hospital notification"}</h2>
            <small>{dateLabel}</small>
          </div>
          <button ref={closeRef} type="button" className="cb-notification-reader-close" onClick={onClose} aria-label="Close notification"><X size={20} /></button>
        </header>

        <div className="cb-notification-reader-body">
          <div className="cb-notification-reader-meta">
            <span><CheckCircle2 size={15} aria-hidden="true" /> {String(notice.status || "sent").replaceAll("_", " ")}</span>
            <span>{notice.to ? `To ${notice.to}` : "CareBridge account"}</span>
          </div>

          <section className="cb-notification-reader-message">
            <small>MESSAGE</small>
            <p id={messageId}>{notice.text || "No additional message content was included."}</p>
          </section>

          {notice.previewUrl && (
            <section className="cb-notification-reader-preview">
              <div>
                <span><strong>Rendered email</strong><small>Preview the formatted hospital message here.</small></span>
                <button type="button" onClick={onTogglePreview}>{showPreview ? "Hide preview" : "Show preview"}</button>
              </div>
              {showPreview && <iframe src={notice.previewUrl} title={`${notice.subject || "Notification"} preview`} />}
            </section>
          )}
        </div>

        <footer className="cb-notification-reader-footer">
          <small>Press Esc or click outside to close.</small>
          <button type="button" onClick={onClose}>Done</button>
        </footer>
      </aside>
    </div>,
    document.body
  );
}
