import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { HOSPITAL } from "../utils";
import { HEALTH_TOPICS } from "../publicContent";
import { useAuth } from "../state";
import { Reveal } from "../components/LiveFX";
import PublicChrome, { PageBanner } from "../components/PublicChrome";

function GuideBody() {
  return (
    <>
      <div className="page-title">
        <div>
          <span className="eyebrow">{HOSPITAL.campus}</span>
          <h1>How CareBridge works</h1>
          <p>A short map of the hospital system — for patients, clinicians, and operations.</p>
        </div>
        <Link className="primary-btn" to="/support">Open help desk</Link>
      </div>
      <section className="card" style={{ marginBottom: 14 }}>
        <h3>Patients</h3>
        <p className="muted">Register, complete a pre-visit form, book a video or campus visit, message your doctor, read labs and visit notes, print prescriptions, and use Shop &amp; pay for unpaid bills, medicines, and labs in one basket — or collect medicines at Ridge pharmacy. Reserve a ward before you travel.</p>
      </section>
      <section className="card" style={{ marginBottom: 14 }}>
        <h3>Doctors</h3>
        <p className="muted">Use the clinic board, toggle Available/Busy, open a chart, file SOAP notes and vitals, issue prescriptions from Messages or the video room, start a teleconsult, and accept admissions.</p>
      </section>
      <section className="card" style={{ marginBottom: 14 }}>
        <h3>Pharmacy nurses</h3>
        <p className="muted">The queue lists hospital pickup orders. On Stock you can toggle in/out of stock, edit a SKU, and restock. Nurses may message only doctors and administrators, not patients.</p>
      </section>
      <section className="card">
        <h3>Hospital operations</h3>
        <p className="muted">Beds, clinic diary, staff directory, paid receipts, the live hospital tariff, revenue, and the audit log. Operations reviews receipts only — patients complete payment in Shop &amp; pay.</p>
      </section>
    </>
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
          {cats.map((c) => (
            <button key={c} type="button" className={cat === c ? "on" : ""} onClick={() => setCat(c)}>{c}</button>
          ))}
          <Link to="/tariff">Hospital tariff</Link>
          <Link to="/patients">For patients</Link>
        </aside>
        <div className="health-list">
          {rows.map((item, i) => (
            <Reveal as="article" className="health-row" delay={i * 50} key={item.id}>
              <div className="health-thumb" style={{ backgroundImage: `url(${item.image})` }} />
              <div>
                <span className="eyebrow">{item.cat}</span>
                <h3>{item.title}</h3>
                <p className="muted">{item.copy}</p>
              </div>
            </Reveal>
          ))}
          <section className="card careers-thin">
            <span className="eyebrow">Careers</span>
            <h3>Working at Ridge Campus</h3>
            <p className="muted">Clinical and operations posts are issued by hospital administration. Write to {HOSPITAL.email} with a CV — this build does not run a public vacancy board.</p>
          </section>
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
