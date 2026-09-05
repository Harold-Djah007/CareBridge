import React from "react";
import { Link } from "react-router-dom";
import { HeartPulse, Video, MessageCircle, BedDouble, ShieldCheck, ArrowRight, Phone, Building2, Stethoscope, FolderOpen, Wallet } from "lucide-react";
import { HOSPITAL } from "../utils";
import { CarePath, EcgRibbon } from "../components/LiveMeter";
import { CountStat, GoldDust, Reveal, SoftOrbs } from "../components/LiveFX";

const SERVICES = [
  { icon: Video, title: "Consultant visits", copy: "Video or campus. Cardiology, paediatrics, orthopaedics, and general medicine — each with a listed fee." },
  { icon: FolderOpen, title: "Clinical file", copy: "Problems, vitals, labs, visit notes, prescriptions, invoices, and receipts stay on the same record." },
  { icon: BedDouble, title: "Admissions", copy: "Request a ward and room type. Accounts invoice the nightly rate when the bed is accepted." },
  { icon: Stethoscope, title: "Clinician workspace", copy: "Clinic list, chart, prescriptions from chat or video, teleconsult room, and admission queue." },
  { icon: Building2, title: "Hospital operations", copy: "Beds, staff directory, clinic diary, live tariff, revenue, patient notices, and an audit trail." },
  { icon: MessageCircle, title: "Pharmacy nursing", copy: "Doctors issue prescriptions from chat or video. Patients buy on site or collect at Ridge. Nurses keep stock live." },
];

export default function Landing() {
  return (
    <div className="landing landing-home">
      <nav className="public-nav">
        <div className="brand">
          <div className="brand-mark live"><HeartPulse size={22} /></div>
          <div><b>{HOSPITAL.name}</b><span>{HOSPITAL.campus}, {HOSPITAL.city}</span></div>
        </div>
        <div className="links">
          <a href="#services">Clinical services</a>
          <Link to="/tariff">Tariff</Link>
          <Link to="/login">Patient sign-in</Link>
          <Link to="/login?role=doctor">Clinician</Link>
          <Link to="/login?role=nurse">Nurse</Link>
          <Link to="/login?role=admin">Operations</Link>
          <Link className="primary-btn cta-pulse" to="/register">Register</Link>
        </div>
      </nav>
      <section className="hero">
        <div className="hero-photo" aria-hidden="true">
          <div className="kb-photo" />
          <div className="hero-shade" />
          <GoldDust />
          <SoftOrbs />
        </div>
        <div className="hero-copy">
          <span className="eyebrow">{HOSPITAL.campus} · Licensed private hospital</span>
          <h1>Exceptional care on one clinical record.</h1>
          <p className="lead">Outpatient, teleconsult, pharmacy, and admissions — billed at published fees, with a receipt for every settlement. Your health, our priority at Ridge Campus, Accra.</p>
          <div className="hero-actions">
            <Link className="primary-btn cta-pulse" to="/login">Patient portal <ArrowRight size={18} /></Link>
            <Link className="secondary-btn" to="/login?role=doctor">Clinician sign-in</Link>
            <Link className="secondary-btn" to="/login?role=nurse">Nurse sign-in</Link>
            <Link className="secondary-btn" to="/login?role=admin">Hospital operations</Link>
          </div>
          <p className="muted hero-phone"><Phone size={16} /> Switchboard {HOSPITAL.phone} · Emergency {HOSPITAL.emergency}</p>
        </div>
        <aside className="hero-panel">
          <div className="hero-panel-ecg" aria-hidden="true"><EcgRibbon /></div>
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
        <div className="hero-ecg" aria-hidden="true"><EcgRibbon /></div>
      </section>
      <section className="trust-band" aria-label="Hospital figures">
        <CountStat value={4} label="Consultants on staff" />
        <CountStat value={44} label="Ward beds on campus" />
        <CountStat value={6} label="Clinical services" />
        <CountStat value={24} suffix="/7" label="Emergency line" />
      </section>
      <section id="services" className="feature-grid">
        {SERVICES.map((item, i) => {
          const Icon = item.icon;
          return (
            <Reveal className="feature-card" delay={i * 70} key={item.title}>
              <Icon />
              <h3>{item.title}</h3>
              <p className="muted">{item.copy}</p>
            </Reveal>
          );
        })}
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
