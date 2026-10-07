import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BedDouble, BookOpenCheck, CreditCard, HeartPulse, LifeBuoy, MessageCircle, Pill, ShieldCheck, Stethoscope, Video } from "lucide-react";
import { HOSPITAL } from "../utils";
import { HEALTH_TOPICS } from "../publicContent";
import { useAuth } from "../state";
import { Reveal } from "../components/LiveFX";
import PublicChrome, { PageBanner } from "../components/PublicChrome";
import PageHero from "../components/PageHero";

const GUIDE_PATHS = [
  { role: "Patient", icon: HeartPulse, title: "Get care without losing context", copy: "Build your care team, book a consultation, message securely, join video, review your record, manage prescriptions and settle hospital bills from one connected patient journey.", links: [["Find care", "/care"], ["Book a visit", "/appointments"], ["My record", "/records"]] },
  { role: "Doctor", icon: Stethoscope, title: "Move from queue to clinical action", copy: "Use the schedule and caseload to open charts, document encounters, issue prescriptions, communicate with patients and move directly into teleconsultation.", links: [["Clinical schedule", "/appointments"], ["Caseload", "/care"], ["Clinical inbox", "/messages"]] },
  { role: "Pharmacy", icon: Pill, title: "Keep dispensing operational", copy: "Use the dispensing workflow and live stock console to maintain what patients can collect or buy, while keeping clinical communication inside authorised channels.", links: [["Inventory", "/pharmacy-stock"], ["Messages", "/messages"]] },
  { role: "Operations", icon: ShieldCheck, title: "Run the hospital from live workspaces", copy: "Manage people, appointments, bed pressure, cases, accounts, receipts, support and governance without dropping back into disconnected admin pages.", links: [["Operations", "/admin"], ["Cases", "/admin/cases"], ["Reports", "/admin/reports"]] },
];

function GuideBody() {
  return (
    <div className="guide-workspace">
      <PageHero
        scene="support"
        eyebrow={`${HOSPITAL.campus} · Product guide`}
        title="CareBridge, mapped by real work"
        lead="A practical operating guide for patients, clinicians, pharmacy staff and hospital operations — organised around what each role needs to accomplish."
        actions={<Link className="primary-btn" to="/support"><LifeBuoy size={16} /> Open help desk</Link>}
      />

      <section className="guide-command-strip">
        <div><BookOpenCheck size={18} /><span><b>Start with your role</b><small>Use the paths below as shortcuts into live workflows.</small></span></div>
        <div><MessageCircle size={18} /><span><b>Need a person?</b><small>Messages keeps care and operations conversations in context.</small></span></div>
        <div><Video size={18} /><span><b>Need a consultation?</b><small>Appointments and video share the same care relationship.</small></span></div>
        <div><CreditCard size={18} /><span><b>Need to settle care?</b><small>Shop & pay keeps bills, medicines and services together.</small></span></div>
      </section>

      <section className="guide-role-grid">
        {GUIDE_PATHS.map(({ role, icon: Icon, title, copy, links }) => (
          <article className="guide-role-card" key={role}>
            <div className="guide-role-icon"><Icon size={20} /></div>
            <span className="eyebrow">{role}</span>
            <h2>{title}</h2>
            <p>{copy}</p>
            <div className="guide-role-links">{links.map(([label, to]) => <Link key={to} to={to}>{label}</Link>)}</div>
          </article>
        ))}
      </section>

      <section className="guide-journey-panel">
        <header><div><span className="eyebrow">Connected patient journey</span><h2>From first contact to follow-up</h2></div><span className="guide-live"><i /> One record, one workflow</span></header>
        <div className="guide-journey">
          <Link to="/care"><span>01</span><div><b>Choose care</b><small>Find or manage the care relationship.</small></div></Link>
          <Link to="/appointments"><span>02</span><div><b>Schedule</b><small>Book video or campus care.</small></div></Link>
          <Link to="/messages"><span>03</span><div><b>Prepare</b><small>Share context securely before the encounter.</small></div></Link>
          <Link to="/video"><span>04</span><div><b>Consult</b><small>Enter the protected telehealth room.</small></div></Link>
          <Link to="/records"><span>05</span><div><b>Review</b><small>Open the longitudinal clinical record.</small></div></Link>
          <Link to="/prescriptions"><span>06</span><div><b>Treat</b><small>Follow medication orders and fulfilment.</small></div></Link>
          <Link to="/pay"><span>07</span><div><b>Settle</b><small>Pay bills and purchase connected services.</small></div></Link>
          <Link to="/wards"><span>08</span><div><b>Escalate when needed</b><small>Reserve admission capacity before arrival.</small></div></Link>
        </div>
      </section>

      <div className="guide-assurance"><BedDouble size={17} /><div><b>This guide points to live CareBridge workflows.</b><small>For account, billing, admission, technical or clinical-service issues, use Support so hospital operations receives a real ticket.</small></div><Link className="secondary-btn" to="/support">Contact operations</Link></div>
    </div>
  );
}

function PublicHelp() {
  const cats = useMemo(() => ["All", ...Array.from(new Set(HEALTH_TOPICS.map((t) => t.cat)))], []);
  const [cat, setCat] = useState("All");
  const rows = HEALTH_TOPICS.filter((t) => cat === "All" || t.cat === cat);

  return (
    <PublicChrome>
      <PageBanner
        eyebrow="Health Information"
        title="Guides from Ridge Campus"
        lead="Practical notes on visits, pharmacy, bills, and specialty follow-up. This is not a substitute for a consultation."
        image="/imagery/records.jpg"
      />
      <div className="hospital-inner about-layout">
        <aside className="side-nav">
          {cats.map((c) => <button key={c} type="button" className={cat === c ? "on" : ""} onClick={() => setCat(c)}>{c}</button>)}
          <Link to="/tariff">Hospital tariff</Link>
          <Link to="/patients">For patients</Link>
        </aside>
        <div className="health-list">
          {rows.map((item, i) => (
            <Reveal as="article" className="health-row" delay={i * 50} key={item.id}>
              <div className="health-thumb" style={{ backgroundImage: `url(${item.image})` }} />
              <div><span className="eyebrow">{item.cat}</span><h3>{item.title}</h3><p className="muted">{item.copy}</p></div>
            </Reveal>
          ))}
          <section className="card careers-thin"><span className="eyebrow">Careers</span><h3>Working at Ridge Campus</h3><p className="muted">Clinical and operations posts are issued by hospital administration. Write to {HOSPITAL.email} with a CV — this build does not run a public vacancy board.</p></section>
        </div>
      </div>
    </PublicChrome>
  );
}

export default function Help() {
  const { user } = useAuth();
  if (user) return <GuideBody />;
  return <PublicHelp />;
}
