import React from "react";
import { Link } from "react-router-dom";
import { HeartPulse, Video, MessageCircle, BedDouble, ShieldCheck, ArrowRight, Stethoscope, Mail } from "lucide-react";

export default function Landing() {
  return (
    <div className="landing">
      <nav className="public-nav">
        <div className="brand"><div className="brand-mark"><HeartPulse size={22} /></div><div><b>CareBridge</b><span>Health</span></div></div>
        <div className="links">
          <a href="#features">Care</a>
          <a href="#how">How it works</a>
          <Link to="/login">Sign in</Link>
          <Link className="primary-btn" to="/register">Create account</Link>
        </div>
      </nav>
      <section className="hero">
        <div>
          <span className="eyebrow">Hospital care, without the waiting room maze</span>
          <h1>Consult your doctor. Chat live. Reserve a ward before you arrive.</h1>
          <p className="lead">CareBridge is a calm, professional workspace for patients, doctors, and hospital administrators — video visits, secure messages, admissions, and email alerts in one place.</p>
          <div className="hero-actions">
            <Link className="primary-btn" to="/login?role=patient">I’m a patient <ArrowRight size={18} /></Link>
            <Link className="secondary-btn" to="/login?role=doctor">I’m a doctor</Link>
            <Link className="secondary-btn" to="/login?role=admin">Hospital admin</Link>
          </div>
          <div className="role-pills">
            <span className="muted">Includes email alerts for scheduled visits and ward acceptance.</span>
          </div>
        </div>
        <aside className="hero-panel">
          <span className="eyebrow">Today in clinic</span>
          <h3>Ama Mensah · Video visit 10:30</h3>
          <p className="muted">Dr. Kwame Owusu · General Medicine</p>
          <div className="appointment-feature" style={{ marginTop: 16 }}>
            <div className="avatar">KO</div>
            <div className="grow"><b>Join when ready</b><span className="muted">Camera room is prepared</span></div>
            <Video />
          </div>
          <div className="appointment-feature" style={{ marginTop: 10 }}>
            <div className="avatar">NA</div>
            <div className="grow"><b>Ward accepted</b><span className="muted">Email alert sent to the patient</span></div>
            <Mail />
          </div>
        </aside>
      </section>
      <section id="features" className="feature-grid">
        <div className="feature-card"><Video /><h3>Video consultation</h3><p className="muted">Meet privately from home with camera, mic, and screen sharing that actually work.</p></div>
        <div className="feature-card"><MessageCircle /><h3>Live care chat</h3><p className="muted">Message your doctor before and after the visit. Files can be shared in the thread.</p></div>
        <div className="feature-card"><BedDouble /><h3>Ward booking</h3><p className="muted">Reserve a bed before you travel. Staff accept the request and you get an email.</p></div>
      </section>
      <section id="how" className="steps">
        <div className="step"><b>1</b><h3>Sign in</h3><p className="muted">Patient, doctor, or admin — each workspace is tailored.</p></div>
        <div className="step"><b>2</b><h3>Book care</h3><p className="muted">Choose a clinician, time, and video or in-person visit.</p></div>
        <div className="step"><b>3</b><h3>Stay notified</h3><p className="muted">Email alerts fire when visits are scheduled or wards are accepted.</p></div>
        <div className="step"><b>4</b><h3>Arrive prepared</h3><p className="muted">Join the call or walk in with a confirmed bed waiting.</p></div>
      </section>
      <footer className="landing-foot">
        <span>CareBridge Health</span>
        <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}><ShieldCheck size={16} /> Privacy-minded demo for modern hospitals</span>
        <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}><Stethoscope size={16} /> Patient · Doctor · Admin</span>
      </footer>
    </div>
  );
}
