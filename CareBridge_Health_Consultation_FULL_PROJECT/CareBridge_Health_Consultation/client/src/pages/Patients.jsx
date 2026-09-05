import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CalendarDays, UserRound, Wallet, HelpCircle, BedDouble } from "lucide-react";
import { HOSPITAL } from "../utils";
import { PATIENT_FAQS } from "../publicContent";
import { Reveal } from "../components/LiveFX";
import PublicChrome, { PageBanner } from "../components/PublicChrome";

const GUIDES = [
  { id: "guide", label: "Patient guide" },
  { id: "links", label: "Quick links" },
  { id: "faq", label: "FAQs" },
];

const LINKS = [
  { to: "/login", icon: UserRound, title: "Patient portal", copy: "File, invoices, prescriptions, and receipts" },
  { to: "/book", icon: CalendarDays, title: "Book Appointment", copy: "Register a file, then confirm a clinic or video slot" },
  { to: "/tariff", icon: Wallet, title: "Hospital tariff", copy: "Published fees before you book or pay" },
  { to: "/login", icon: BedDouble, title: "Reserve a bed", copy: "Request a ward after you have a patient file" },
];

export default function Patients() {
  const [tab, setTab] = useState("guide");
  return (
    <PublicChrome>
      <PageBanner
        eyebrow="For Patients"
        title="A short guide to using Ridge Campus"
        lead="Register a file, book a named consultant, settle published fees, and keep labs and receipts on the same record."
        image="/imagery/corridor.jpg"
      />
      <div className="hospital-inner about-layout">
        <aside className="side-nav">
          {GUIDES.map((s) => (
            <button key={s.id} type="button" className={tab === s.id ? "on" : ""} onClick={() => setTab(s.id)}>
              {s.label}
            </button>
          ))}
          <Link to="/help">Health information</Link>
          <Link to="/contact">Contact the desk</Link>
        </aside>
        <div className="about-main">
          {tab === "guide" && (
            <div className="guide-stack">
              <Reveal as="article" className="guide-card">
                <div className="guide-photo" style={{ backgroundImage: "url(/imagery/clinic.jpg)" }} />
                <div>
                  <h2>Before you arrive</h2>
                  <p className="muted">Bring a valid ID, any referral, and medicines you already take. New patients register online or at the front desk. Established patients sign in to the portal.</p>
                </div>
              </Reveal>
              <Reveal as="article" className="guide-card" delay={80}>
                <div className="guide-photo" style={{ backgroundImage: "url(/imagery/teleconsult.jpg)" }} />
                <div>
                  <h2>During the visit</h2>
                  <p className="muted">History, examination, and a plan are filed the same day — on campus or by video. Prescriptions can be collected at Ridge or added to Shop &amp; pay.</p>
                </div>
              </Reveal>
            </div>
          )}
          {tab === "links" && (
            <div className="icon-service-grid two">
              {LINKS.map((item, i) => {
                const Icon = item.icon;
                return (
                  <Reveal as={Link} className="icon-service" delay={i * 60} key={item.title} to={item.to}>
                    <span className="icon-circle"><Icon size={22} /></span>
                    <h3>{item.title}</h3>
                    <p className="muted">{item.copy}</p>
                    <span>Open <ArrowRight size={16} /></span>
                  </Reveal>
                );
              })}
            </div>
          )}
          {tab === "faq" && (
            <div className="faq-list">
              {PATIENT_FAQS.map((item) => (
                <details key={item.q} className="faq-item">
                  <summary><HelpCircle size={16} /> {item.q}</summary>
                  <p className="muted">{item.a}</p>
                </details>
              ))}
              <p className="muted">Switchboard {HOSPITAL.phone} · {HOSPITAL.email}</p>
            </div>
          )}
        </div>
      </div>
    </PublicChrome>
  );
}
