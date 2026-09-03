import React from "react";
import { Link } from "react-router-dom";
import { HOSPITAL } from "../utils";

export default function Privacy() {
  return (
    <div className="landing">
      <nav className="public-nav">
        <Link to="/" className="brand"><b>{HOSPITAL.short}</b></Link>
        <div className="links"><Link to="/help">Help</Link><Link to="/login">Sign in</Link></div>
      </nav>
      <div className="page-title">
        <div>
          <span className="eyebrow">Legal</span>
          <h1>Privacy & record access</h1>
          <p>{HOSPITAL.name} holds clinical information so your care team can treat you safely.</p>
        </div>
      </div>
      <section className="card">
        <p>Patient files include identity, visits, messages, ward stays, medicines, labs, notes, invoices, and email notices. Doctors see people on their caseload. Administrators see operational data and the audit trail. Passwords are stored for this training build only — a live hospital would use hashed credentials, signed sessions, and Ghana Data Protection Act controls.</p>
        <p>You can turn email alerts off under My details. For a live deployment, request a records export from the records office at {HOSPITAL.phone}.</p>
        <p className="muted">Telehealth consent is collected before a video consult. Version 2026.1.</p>
      </section>
    </div>
  );
}
