import React, { useState } from "react";
import { MapPin, Phone, Mail, Clock, ShieldAlert } from "lucide-react";
import { api } from "../api";
import { HOSPITAL } from "../utils";
import { useToast } from "../state";
import PublicChrome, { PageBanner } from "../components/PublicChrome";

const FACTS = [
  { icon: MapPin, title: "Location", body: HOSPITAL.address },
  { icon: Phone, title: "Phone", body: HOSPITAL.phone },
  { icon: Mail, title: "Email", body: HOSPITAL.email },
  { icon: Clock, title: "Hours", body: `Clinic ${HOSPITAL.hours}` },
];

export default function Contact() {
  const { push } = useToast();
  const [form, setForm] = useState({ name: "", email: "", phone: "", subject: "", message: "" });
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setOk(false);
    try {
      await api("/contact", { method: "POST", body: JSON.stringify(form) });
      setOk(true);
      setForm({ name: "", email: "", phone: "", subject: "", message: "" });
      push("Message sent to the Ridge desk.");
    } catch (err) {
      push(err.message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <PublicChrome>
      <PageBanner
        eyebrow="Contact Us"
        title="Ridge Campus switchboard"
        lead={`For scheduled care call ${HOSPITAL.phone}. For a life-threatening emergency call ${HOSPITAL.emergency}.`}
        image="/imagery/hero-campus.jpg"
      />
      <div className="hospital-inner">
        <div className="contact-facts-grid">
          {FACTS.map((item) => {
            const Icon = item.icon;
            return (
              <article className="contact-fact" key={item.title}>
                <span className="icon-circle"><Icon size={20} /></span>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </article>
            );
          })}
        </div>
        <div className="contact-split">
          <form className="card contact-form" onSubmit={submit}>
            <h2>Send us a message</h2>
            <p className="muted">The records office reads these during clinic hours. This is not for emergencies.</p>
            <label>Name<input value={form.name} onChange={(e) => set("name", e.target.value)} required /></label>
            <div className="form-grid">
              <label>Email<input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} required /></label>
              <label>Phone<input value={form.phone} onChange={(e) => set("phone", e.target.value)} /></label>
            </div>
            <label>Subject<input value={form.subject} onChange={(e) => set("subject", e.target.value)} /></label>
            <label>Message<textarea rows="5" value={form.message} onChange={(e) => set("message", e.target.value)} required /></label>
            {ok && <div className="success-box">Thank you. The Ridge desk has your message.</div>}
            <button className="primary-btn" disabled={busy}>{busy ? "Sending…" : "Send message"}</button>
            <p className="muted"><ShieldAlert size={14} /> Emergency {HOSPITAL.emergency} · {HOSPITAL.emergencyHours}</p>
          </form>
          <div className="map-embed card">
            <iframe
              title="CareBridge Medical Centre, Ridge, Accra"
              src="https://maps.google.com/maps?q=Independence%20Avenue%20Ridge%20Accra&z=15&output=embed"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>
      </div>
    </PublicChrome>
  );
}
