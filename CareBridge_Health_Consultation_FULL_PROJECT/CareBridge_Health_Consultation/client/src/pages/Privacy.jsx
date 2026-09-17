import React from "react";
import { HOSPITAL } from "../utils";
import PublicChrome, { PageBanner } from "../components/PublicChrome";

export default function Privacy() {
  return (
    <PublicChrome>
      <PageBanner
        eyebrow="Legal"
        title="Privacy & record access"
        lead={`${HOSPITAL.name} holds clinical information so your care team can treat you safely.`}
        image="/imagery/records.jpg"
      />
      <div className="hospital-inner">
        <section className="card prose-card">
          <h2>What we keep on file</h2>
          <p>Patient files include identity, visits, messages, ward stays, medicines, labs, notes, invoices, and email notices. Doctors see people on their caseload. Administrators see operational data and the audit trail.</p>
          <p>You can turn email alerts off under Account. For a live deployment, request a records export from the records office at {HOSPITAL.phone}.</p>
          <p>Telehealth consent is collected before a video consult. Social media pages published on this website are public channels — they are not used to discuss your clinical file.</p>
          <p className="muted">Version 2026.1 · {HOSPITAL.campus}, {HOSPITAL.city}.</p>
        </section>
      </div>
    </PublicChrome>
  );
}
