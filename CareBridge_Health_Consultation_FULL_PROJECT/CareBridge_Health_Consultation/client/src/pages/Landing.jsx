import React from "react";
import { Link } from "react-router-dom";
import { HeartPulse, Video, MessageCircle, BedDouble, ShieldCheck, ArrowRight, Phone } from "lucide-react";
import { HOSPITAL } from "../utils";
import { Heartbeat } from "../components/LiveMeter";

export default function Landing() {
  return (
    <div className="landing">
      <nav className="public-nav">
        <div className="brand"><div className="brand-mark live"><HeartPulse size={22} /></div><div><b>{HOSPITAL.name}</b><span>{HOSPITAL.campus}, {HOSPITAL.city}</span></div></div>
        <div className="links">
          <a href="#services">Services</a>
          <a href="#portal">Patient portal</a>
          <Link to="/login">Patient sign-in</Link>
          <Link to="/login?role=doctor">Staff</Link>
          <Link className="primary-btn" to="/register">Register</Link>
        </div>
      </nav>
      <section className="hero">
        <div>
          <span className="eyebrow">{HOSPITAL.campus} · Open 24 hours</span>
          <h1>Hospital care you can start from home, and finish on the ward.</h1>
          <p className="lead">See a consultant on video, keep your messages in one record, and reserve a bed before you travel to Accra. Confirmations are sent to the email on your file.</p>
          <div className="hero-actions">
            <Link className="primary-btn" to="/login">Open patient portal <ArrowRight size={18} /></Link>
            <Link className="secondary-btn" to="/login?role=doctor">Staff sign-in</Link>
          </div>
          <p className="muted" style={{ display: "flex", gap: 8, alignItems: "center" }}><Phone size={16} /> Emergency {HOSPITAL.emergency}</p>
        </div>
        <aside className="hero-panel">
          <Heartbeat variant="patient" />
          <span className="eyebrow">Ridge Campus</span>
          <h3>Outpatient & admissions</h3>
          <p className="muted">General medicine, cardiology, paediatrics, orthopaedics, and inpatient wards on one site.</p>
          <div className="appointment-feature" style={{ marginTop: 16 }}>
            <Video />
            <div className="grow"><b>Teleconsult clinics</b><span className="muted">Weekdays 08:00–18:00</span></div>
          </div>
          <div className="appointment-feature" style={{ marginTop: 10 }}>
            <BedDouble />
            <div className="grow"><b>Bed reservation</b><span className="muted">Request a ward before arrival</span></div>
          </div>
        </aside>
      </section>
      <section id="services" className="feature-grid">
        <div className="feature-card"><Video /><h3>Consultant video visits</h3><p className="muted">Join from a private room. Camera, microphone, and screen share are part of the consult.</p></div>
        <div className="feature-card"><MessageCircle /><h3>Messages on your record</h3><p className="muted">Write to your doctor before and after a visit. You also receive an email when they reply.</p></div>
        <div className="feature-card"><BedDouble /><h3>Arrive to a reserved bed</h3><p className="muted">Request general, medical, maternity, or paediatric accommodation. Admissions confirm by email.</p></div>
      </section>
      <footer className="landing-foot">
        <span>{HOSPITAL.name}</span>
        <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}><ShieldCheck size={16} /> Patient records are access-controlled</span>
        <Link to="/login?role=admin">Hospital operations</Link>
      </footer>
    </div>
  );
}
