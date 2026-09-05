import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Phone, Video, Wallet, ShieldAlert, MapPin, Clock, Mail } from "lucide-react";
import { CONSULTANTS, HOSPITAL } from "../utils";
import { CarePath, EcgRibbon } from "../components/LiveMeter";
import { CountStat, GoldDust, Reveal, SoftOrbs } from "../components/LiveFX";
import PublicChrome from "../components/PublicChrome";

const SERVICES = [
  {
    id: "teleconsult",
    title: "Telemedicine",
    image: "/imagery/teleconsult.jpg",
    copy: "Secure video with a Ridge consultant. Share records, get a second opinion, or follow up after a campus visit without travelling to Accra.",
    to: "/register",
    cta: "Request a teleconsult",
  },
  {
    id: "outpatient",
    title: "Outpatient",
    image: "/imagery/clinic.jpg",
    copy: "General medicine, cardiology, paediatrics, and orthopaedics on a booked clinic list. Walk-ins are registered at the Ridge front desk.",
    to: "/register",
    cta: "Book a clinic visit",
  },
  {
    id: "pharmacy",
    title: "Pharmacy",
    image: "/imagery/pharmacy.jpg",
    copy: "Prescriptions written from chat or video. Collect at the Ridge cupboard or add medicines to Shop & pay once you have a patient file.",
    to: "/login",
    cta: "Open the portal",
  },
  {
    id: "admissions",
    title: "Admissions",
    image: "/imagery/wards.jpg",
    copy: "Request a ward and room type before you travel. Accounts invoice the nightly rate when the bed is accepted.",
    to: "/login",
    cta: "Reserve a bed",
  },
  {
    id: "records",
    title: "Records",
    image: "/imagery/records.jpg",
    copy: "Problems, vitals, labs, visit notes, prescriptions, invoices, and receipts stay on the same medical record number.",
    to: "/login",
    cta: "Access your file",
  },
];

const STEPS = [
  { n: "01", title: "Book or register", copy: "Open a patient file online, or speak to the front desk on arrival. Bring a valid ID, any referral, and medicines you already take." },
  { n: "02", title: "Consultation", copy: "See your consultant on video or at Ridge. History, examination, and a plan are filed on your record the same day." },
  { n: "03", title: "Treatment & pharmacy", copy: "Labs, imaging requests, and prescriptions follow the published tariff. Pay by MoMo, GCB, NHIS, or cash for a numbered receipt." },
  { n: "04", title: "Follow-up", copy: "Return visits, teleconsult reviews, and ward stays stay on the same file so the next clinician is not starting from a blank page." },
];

export default function Landing() {
  return (
    <PublicChrome variant="home">
      <section className="hero">
        <div className="hero-photo" aria-hidden="true">
          <div className="kb-photo" />
          <div className="hero-shade" />
          <GoldDust />
          <SoftOrbs />
        </div>
        <div className="hero-copy">
          <span className="eyebrow">{HOSPITAL.campus} · Licensed private hospital</span>
          <h1>Private hospital care on one clinical record.</h1>
          <p className="lead">
            Outpatient clinic, teleconsult, pharmacy, and admissions at {HOSPITAL.name}, {HOSPITAL.city}.
            Book a visit, then sign in to the patient portal for your file, invoices, and receipts.
          </p>
          <div className="hero-actions">
            <Link className="primary-btn cta-pulse" to="/register">Book a consultation <ArrowRight size={18} /></Link>
            <Link className="secondary-btn" to="/login">Patient portal</Link>
            <Link className="secondary-btn" to="/tariff">Hospital tariff</Link>
          </div>
          <p className="muted hero-phone"><Phone size={16} /> Switchboard {HOSPITAL.phone} · Emergency {HOSPITAL.emergency}</p>
        </div>
        <aside className="hero-panel">
          <div className="hero-panel-ecg" aria-hidden="true"><EcgRibbon /></div>
          <CarePath caption="Home → register → consult → ward" />
          <span className="eyebrow">Book a visit</span>
          <h3>Seen faster on a booked list</h3>
          <p className="muted">New patients register a file. Established patients sign in to the portal. Either way, the consultant you need is on the Ridge directory — not a waiting-room lottery.</p>
          <div className="appointment-feature" style={{ marginTop: 16 }}>
            <Wallet />
            <div className="grow"><b>GCB 1011130022847</b><span className="muted">CareBridge Medical Centre Ltd · Ridge</span></div>
          </div>
          <div className="appointment-feature" style={{ marginTop: 10 }}>
            <Video />
            <div className="grow"><b>MoMo merchant CB-RIDGE-001</b><span className="muted">MTN 0245550100 · Telecel 0205550100 · AT 0275550100</span></div>
          </div>
          <Link className="ghost-btn" to="/tariff" style={{ marginTop: 12 }}>Open the published tariff</Link>
        </aside>
        <div className="hero-ecg" aria-hidden="true"><EcgRibbon /></div>
      </section>

      <section className="trust-band" aria-label="Hospital figures">
        <CountStat value={4} label="Consultants on staff" />
        <CountStat value={44} label="Ward beds on campus" />
        <CountStat value={5} label="Clinical services" />
        <CountStat value={24} suffix="/7" label="Emergency line" />
      </section>

      <section id="services" className="service-block">
        <div className="section-head">
          <span className="eyebrow">Clinical services</span>
          <h2>How Ridge Campus looks after you</h2>
          <p className="muted">Each service has a desk on campus and a path in the patient portal. Fees sit on the public tariff before you book.</p>
        </div>
        <div className="service-grid">
          {SERVICES.map((item, i) => (
            <Reveal as="article" className="service-card" delay={i * 70} key={item.id} id={item.id}>
              <div className="service-photo" style={{ backgroundImage: `url(${item.image})` }} />
              <div className="service-copy">
                <h3>{item.title}</h3>
                <p className="muted">{item.copy}</p>
                <Link to={item.to}>{item.cta} <ArrowRight size={16} /></Link>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section id="visit" className="visit-block">
        <div className="section-head">
          <span className="eyebrow">Your first visit</span>
          <h2>How a visit works</h2>
          <p className="muted">The same four steps whether you arrive at Ridge or join a teleconsult from outside Accra.</p>
        </div>
        <div className="steps visit-steps">
          {STEPS.map((step, i) => (
            <Reveal className="step visit-step" delay={i * 80} key={step.n}>
              <b>{step.n}</b>
              <h3>{step.title}</h3>
              <p className="muted">{step.copy}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <section id="consultants" className="consultant-block">
        <div className="section-head">
          <span className="eyebrow">Find a doctor</span>
          <h2>Consultants at Ridge Campus</h2>
          <p className="muted">A short directory of the four consultants on this hospital build. Sign in to see live available / busy status and book.</p>
        </div>
        <div className="consultant-grid">
          {CONSULTANTS.map((doc, i) => (
            <Reveal as="article" className="consultant-card" delay={i * 70} key={doc.id}>
              <img src={doc.photo} alt="" width="160" height="160" />
              <div>
                <h3>{doc.name}</h3>
                <span className="eyebrow">{doc.specialty}</span>
                <p className="muted">{doc.about}</p>
                <small className="muted">{doc.years} years in practice</small>
              </div>
            </Reveal>
          ))}
        </div>
        <div className="section-actions">
          <Link className="primary-btn" to="/register">Register to book <ArrowRight size={16} /></Link>
          <Link className="secondary-btn" to="/login">Patient portal</Link>
        </div>
      </section>

      <section id="contact" className="contact-strip">
        <div>
          <span className="eyebrow">Contact & emergency</span>
          <h2>Ridge Campus is open for scheduled care</h2>
          <p>For a life-threatening emergency call {HOSPITAL.emergency}. The switchboard books clinic slots and teleconsults during clinic hours.</p>
        </div>
        <ul className="contact-facts">
          <li><MapPin size={18} /><span><b>Address</b>{HOSPITAL.address}</span></li>
          <li><Phone size={18} /><span><b>Switchboard</b>{HOSPITAL.phone}</span></li>
          <li><ShieldAlert size={18} /><span><b>Emergency</b>{HOSPITAL.emergency} · {HOSPITAL.emergencyHours}</span></li>
          <li><Clock size={18} /><span><b>Clinic</b>{HOSPITAL.hours}<br />Visiting {HOSPITAL.visiting}</span></li>
          <li><Mail size={18} /><span><b>Appointments</b>{HOSPITAL.email}</span></li>
        </ul>
        <div className="contact-ctas">
          <Link className="primary-btn cta-pulse" to="/register">Book a consultation</Link>
          <Link className="secondary-btn" to="/help">Help desk</Link>
        </div>
      </section>
    </PublicChrome>
  );
}
