import React, { useState } from "react";
import { Link } from "react-router-dom";
import { HOSPITAL } from "../utils";
import { CountStat, Reveal } from "../components/LiveFX";
import PublicChrome, { PageBanner } from "../components/PublicChrome";

const SECTIONS = [
  { id: "story", label: "Our story" },
  { id: "mission", label: "Mission & vision" },
  { id: "campus", label: "The campus" },
];

export default function About() {
  const [tab, setTab] = useState("story");
  return (
    <PublicChrome>
      <PageBanner
        eyebrow="About Us"
        title="CareBridge Medical Centre"
        lead={`${HOSPITAL.campus}, ${HOSPITAL.city} — a licensed private hospital for scheduled outpatient, teleconsult, pharmacy, and admissions.`}
        image="/imagery/hero-campus.jpg"
      />
      <div className="hospital-inner about-layout">
        <aside className="side-nav">
          {SECTIONS.map((s) => (
            <button key={s.id} type="button" className={tab === s.id ? "on" : ""} onClick={() => setTab(s.id)}>
              {s.label}
            </button>
          ))}
          <Link to="/doctors">Find a doctor</Link>
          <Link to="/contact">Contact</Link>
        </aside>
        <div className="about-main">
          {tab === "story" && (
            <Reveal as="section" className="prose-card">
              <h2>Our story</h2>
              <p>CareBridge opened Ridge Campus so Accra families could keep one clinical file across a booked clinic visit, a video follow-up, the hospital pharmacy, and a reserved bed. The hospital is not a walk-in casualty — it is scheduled care with named consultants.</p>
              <p>Patients register a file, clinicians write on that file, and accounts issue a numbered receipt for every settled bill. The same medical record number follows you from the front desk to the ward.</p>
            </Reveal>
          )}
          {tab === "mission" && (
            <Reveal as="section" className="prose-card">
              <h2>Mission &amp; vision</h2>
              <p><b>Mission.</b> Deliver private hospital care that is booked, billed, and documented on one record — so patients and clinicians are never starting from a blank page.</p>
              <p><b>Vision.</b> A Ridge campus where outpatient, teleconsult, pharmacy, and admissions feel like one hospital, not four disconnected desks.</p>
              <p>We do not replace 24-hour emergency services. For a life-threatening emergency call {HOSPITAL.emergency}.</p>
            </Reveal>
          )}
          {tab === "campus" && (
            <Reveal as="section" className="prose-card">
              <h2>The campus</h2>
              <p>{HOSPITAL.address}. Clinic hours {HOSPITAL.hours}. Visiting {HOSPITAL.visiting}.</p>
              <p>Forty-four ward beds, a ground-floor pharmacy, records office, and consulting rooms for general medicine, cardiology, paediatrics, and orthopaedics. Teleconsults use the same consultants as the campus list.</p>
              <div className="campus-photo" style={{ backgroundImage: "url(/imagery/corridor.jpg)" }} />
            </Reveal>
          )}
        </div>
      </div>
      <section className="trust-band about-stats" aria-label="Hospital figures">
        <CountStat value={4} label="Specialist doctors" />
        <CountStat value={44} label="Ward beds" />
        <CountStat value={8} label="Clinical services" />
        <CountStat value={24} suffix="/7" label="Emergency line" />
      </section>
    </PublicChrome>
  );
}
