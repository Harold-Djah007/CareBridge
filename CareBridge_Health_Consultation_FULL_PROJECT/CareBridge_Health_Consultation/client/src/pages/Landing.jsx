import React from "react";
import { Link } from "react-router-dom";
import { HeartPulse, Video, MessageCircle, BedDouble, ShieldCheck, ArrowRight, Phone, Building2, Stethoscope, FolderOpen, Wallet } from "lucide-react";
import { HOSPITAL } from "../utils";
import { CarePath } from "../components/LiveMeter";

export default function Landing() {
  return (
    <div className="landing">
      <nav className="public-nav">
        <div className="brand"><div className="brand-mark live"><HeartPulse size={22} /></div><div><b>{HOSPITAL.name}</b><span>{HOSPITAL.campus}, {HOSPITAL.city}</span></div></div>
        <div className="links">
          <a href="#services">Clinical services</a>
          <Link to="/tariff">Tariff</Link>
          <Link to="/login">Patient sign-in</Link>
          <Link to="/login?role=doctor">Clinician</Link>
          <Link to="/login?role=nurse">Nurse</Link>
          <Link to="/login?role=admin">Operations</Link>
          <Link className="primary-btn" to="/register">Register</Link>
        </div>
      </nav>
      <section className="hero">
        <div>
          <span className="eyebrow">{HOSPITAL.campus} · Licensed private hospital</span>
          <h1>Outpatient, teleconsult, pharmacy, and admissions on one clinical record.</h1>
          <p className="lead">Patients book a consultant, pay published fees, and collect a receipt. Doctors work a clinic list and the chart. Pharmacy nurses prepare hospital pickups and keep the cupboard current. Operations run beds, staff, and accounts.</p>
          <div className="hero-actions">
            <Link className="primary-btn" to="/login">Patient portal <ArrowRight size={18} /></Link>
            <Link className="secondary-btn" to="/login?role=doctor">Clinician sign-in</Link>
            <Link className="secondary-btn" to="/login?role=nurse">Nurse sign-in</Link>
            <Link className="secondary-btn" to="/login?role=admin">Hospital operations</Link>
          </div>
          <p className="muted" style={{ display: "flex", gap: 8, alignItems: "center" }}><Phone size={16} /> Switchboard {HOSPITAL.phone} · Emergency {HOSPITAL.emergency}</p>
        </div>
        <aside className="hero-panel">
          <CarePath caption="Home → visit → consult → ward" />
          <span className="eyebrow">Ridge Campus</span>
          <h3>How a visit is billed</h3>
          <p className="muted">Consultant fees by specialty, ward rates by night, laboratory and pharmacy at published prices. Settlement: MTN / Telecel / AirtelTigo MoMo, GCB Ridge, NHIS, or cash.</p>
          <div className="appointment-feature" style={{ marginTop: 16 }}>
            <Wallet />
            <div className="grow"><b>GCB 1011130022847</b><span className="muted">CareBridge Medical Centre Ltd · Ridge</span></div>
          </div>
          <div className="appointment-feature" style={{ marginTop: 10 }}>
            <Video />
            <div className="grow"><b>MoMo merchant CB-RIDGE-001</b><span className="muted">MTN 0245550100 · Telecel 0205550100 · AT 0275550100</span></div>
          </div>
          <Link className="ghost-btn" to="/tariff" style={{ marginTop: 12 }}>Open full tariff</Link>
        </aside>
      </section>
      <section id="services" className="feature-grid">
        <div className="feature-card"><Video /><h3>Consultant visits</h3><p className="muted">Video or campus. Cardiology, paediatrics, orthopaedics, and general medicine — each with a listed fee.</p></div>
        <div className="feature-card"><FolderOpen /><h3>Clinical file</h3><p className="muted">Problems, vitals, labs, visit notes, prescriptions, invoices, and receipts stay on the same record.</p></div>
        <div className="feature-card"><BedDouble /><h3>Admissions</h3><p className="muted">Request a ward and room type. Accounts invoice the nightly rate when the bed is accepted.</p></div>
        <div className="feature-card"><Stethoscope /><h3>Clinician workspace</h3><p className="muted">Clinic list, chart, prescriptions from chat or video, teleconsult room, and admission queue.</p></div>
        <div className="feature-card"><Building2 /><h3>Hospital operations</h3><p className="muted">Beds, staff directory, clinic diary, live tariff, revenue, patient notices, and an audit trail.</p></div>
        <div className="feature-card"><MessageCircle /><h3>Pharmacy nursing</h3><p className="muted">Doctors issue prescriptions from chat or video. Patients buy on site or collect at Ridge. Nurses keep stock live.</p></div>
      </section>
      <footer className="landing-foot">
        <span>{HOSPITAL.name}</span>
        <Link to="/tariff">Tariff</Link>
        <Link to="/help">How it works</Link>
        <Link to="/privacy">Privacy</Link>
        <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}><ShieldCheck size={16} /> Access-controlled records</span>
        <Link to="/login?role=admin">Hospital operations</Link>
      </footer>
    </div>
  );
}
