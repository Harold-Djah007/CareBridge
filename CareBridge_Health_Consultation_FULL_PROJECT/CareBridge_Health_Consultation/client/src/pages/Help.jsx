import React from "react";
import { Link } from "react-router-dom";
import { HOSPITAL } from "../utils";

export default function Help() {
  return (
    <div className="landing">
      <nav className="public-nav">
        <Link to="/" className="brand"><b>{HOSPITAL.short}</b></Link>
        <div className="links"><Link to="/login">Sign in</Link></div>
      </nav>
      <div className="page-title">
        <div>
          <span className="eyebrow">{HOSPITAL.campus}</span>
          <h1>How CareBridge works</h1>
          <p>A short map of the hospital system — for patients, clinicians, and operations.</p>
        </div>
      </div>
      <section className="card" style={{ marginBottom: 14 }}>
        <h3>Patients</h3>
        <p className="muted">Register, complete a pre-visit form, book a video or campus visit, message your doctor, read labs and visit notes, request medicine refills, pay invoices, and reserve a ward before you travel. Confirmations go to the email on your file.</p>
      </section>
      <section className="card" style={{ marginBottom: 14 }}>
        <h3>Doctors</h3>
        <p className="muted">Use the clinic board, open a chart, file SOAP notes and vitals, issue prescriptions, start a teleconsult, and accept admissions. Allergy flags sit at the top of the record.</p>
      </section>
      <section className="card" style={{ marginBottom: 14 }}>
        <h3>Hospital operations</h3>
        <p className="muted">Administrators sign in with a staff account. The command centre covers beds, the clinic diary, staff directory, outbound notices, revenue, and the audit log.</p>
      </section>
      <section className="card">
        <h3>Emergency</h3>
        <p>Call {HOSPITAL.emergency}. CareBridge is for scheduled care, not a substitute for 24-hour emergency services.</p>
        <p className="muted"><Link to="/privacy">Privacy notice</Link> · Records office {HOSPITAL.phone}</p>
      </section>
    </div>
  );
}
