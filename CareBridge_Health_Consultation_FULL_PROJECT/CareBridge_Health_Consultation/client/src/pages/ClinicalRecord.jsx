import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  Activity, AlertTriangle, ClipboardList, CreditCard, FileHeart, FileText, FlaskConical,
  HeartPulse, Pill, Receipt, ShieldCheck, Stethoscope,
} from "lucide-react";
import { api } from "../api";
import { useAuth, useToast } from "../state";
import { prettyDate } from "../utils";
import Avatar from "../components/Avatar";
import RxPad from "../components/RxPad";
import PageHero, { EmptyPlate } from "../components/PageHero";

const TABS = [
  ["overview", "Summary", FileHeart],
  ["vitals", "Vitals", Activity],
  ["labs", "Laboratory", FlaskConical],
  ["notes", "Clinical notes", FileText],
  ["rx", "Medicines", Pill],
  ["bills", "Billing", Receipt],
  ["intake", "Pre-visit", ClipboardList],
];

const money = (value, currency = "GHS") => `${currency} ${Number(value || 0).toLocaleString()}`;

function RecordNav({ tab, setTab, chart }) {
  const counts = {
    overview: chart.conditions?.length || 0,
    vitals: chart.vitals?.length || 0,
    labs: chart.labs?.length || 0,
    notes: chart.notes?.length || 0,
    rx: chart.prescriptions?.length || 0,
    bills: chart.invoices?.filter((invoice) => invoice.status === "due").length || 0,
    intake: chart.intakes?.length || 0,
  };
  return (
    <nav className="record-section-nav" aria-label="Clinical record sections">
      <span className="eyebrow">Record sections</span>
      {TABS.map(([id, label, Icon]) => <button key={id} type="button" className={tab === id ? "active" : ""} onClick={() => setTab(id)}><span><Icon size={16} /><b>{label}</b></span>{counts[id] > 0 && <em>{counts[id]}</em>}</button>)}
    </nav>
  );
}

export default function ClinicalRecord() {
  const { user } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();
  const { patientId: routeId } = useParams();
  const [params, setParams] = useSearchParams();
  const patientId = routeId || params.get("patient") || (user.role === "patient" ? user.id : "");
  const tab = params.get("tab") || "overview";
  const setTab = (value) => setParams((current) => { const next = new URLSearchParams(current); next.set("tab", value); return next; });

  const [chart, setChart] = useState(null);
  const [note, setNote] = useState({ subjective: "", objective: "", assessment: "", plan: "" });
  const [vital, setVital] = useState({ bp: "120/80", hr: 72, temp: 36.6, spo2: 98, weight: 70 });
  const [intake, setIntake] = useState({ symptoms: "", pain: 3, medsTaken: "", redFlags: false });

  const load = () => {
    if (!patientId) return;
    api(`/chart/${patientId}`).then(setChart).catch((error) => push(error.message, "error"));
  };
  useEffect(() => { load(); }, [patientId]);

  const clinician = user.role === "doctor" || user.role === "admin";
  const saveNote = async (event) => {
    event.preventDefault();
    await api("/notes", { method: "POST", body: JSON.stringify({ ...note, patientId, authorId: user.id }) });
    setNote({ subjective: "", objective: "", assessment: "", plan: "" });
    push("Visit note filed on the record.");
    load();
  };
  const saveVitals = async (event) => {
    event.preventDefault();
    await api("/vitals", { method: "POST", body: JSON.stringify({ ...vital, patientId, actorId: user.id, recordedBy: user.name }) });
    push("Vitals recorded.");
    load();
  };
  const refill = async (id) => {
    await api(`/prescriptions/${id}`, { method: "PATCH", body: JSON.stringify({ refillRequested: true, actorId: user.id }) });
    push("Refill requested from Ridge Campus pharmacy.");
    load();
  };
  const submitIntake = async (event) => {
    event.preventDefault();
    await api("/intakes", { method: "POST", body: JSON.stringify({ ...intake, patientId: user.id }) });
    push("Pre-visit form sent to the clinic.");
    load();
  };

  if (!patientId && clinician) {
    return <div className="record-empty-workspace"><PageHero scene="records" eyebrow="Electronic health record" title="Open a patient chart" lead="Choose a patient from your caseload or directory to enter their clinical workspace." /><EmptyPlate scene="records" icon={FileHeart} title="No patient selected" hint="Open a patient from Caseload to see the complete record."><button className="primary-btn" onClick={() => navigate("/care")}>Go to caseload</button></EmptyPlate></div>;
  }
  if (!chart) return <div className="product-loading"><HeartPulse className="spin-soft" size={20} /><span>Loading clinical record…</span></div>;

  const patient = chart.patient;
  const latest = chart.vitals[0];
  const due = chart.invoices.filter((invoice) => invoice.status === "due");
  const activeMeds = chart.medications.filter((med) => med.status === "active");
  const allergy = patient.allergies && patient.allergies !== "None recorded" ? patient.allergies : null;

  return (
    <div className="clinical-record-workspace">
      <PageHero
        scene="records"
        leading={<Avatar person={patient} className="large" />}
        eyebrow={`Electronic health record · ${patient.mrn || "MRN pending"}`}
        title={user.role === "patient" ? "My clinical record" : patient.name}
        lead={user.role === "patient" ? "Your longitudinal record of conditions, observations, laboratory results, notes, medicines and hospital billing." : "Clinical summary, observations, notes, treatment and patient-account context in one protected workspace."}
        actions={clinician ? <Link className="secondary-btn" to={`/messages?with=${patient.id}`}><Stethoscope size={15} /> Contact patient</Link> : null}
      />

      <div className="record-identity-strip">
        <div><span>Patient</span><b>{patient.name}</b></div>
        <div><span>MRN</span><b>{patient.mrn || "Pending"}</b></div>
        <div><span>Date of birth</span><b>{patient.dob || "—"}</b></div>
        <div><span>Blood group</span><b>{patient.bloodType || "—"}</b></div>
        <div><span>Cover</span><b>{patient.insurance || "Self-pay"}</b></div>
        <div className={allergy ? "record-risk active" : "record-risk"}><span>{allergy ? "Allergy" : "Allergies"}</span><b>{allergy || "None recorded"}</b></div>
      </div>

      {allergy && <div className="record-alert-banner"><AlertTriangle size={17} /><div><b>Allergy alert</b><span>{allergy} · Emergency contact: {patient.emergencyContact || "not listed"}</span></div></div>}

      <div className="record-workspace-grid">
        <aside className="record-left-rail">
          <RecordNav tab={tab} setTab={setTab} chart={chart} />
          <div className="record-assurance"><ShieldCheck size={16} /><div><b>Protected record</b><small>Access follows CareBridge role and patient ownership rules.</small></div></div>
        </aside>

        <main className="record-main-panel">
          {tab === "overview" && (
            <div className="record-summary-stack">
              <div className="record-summary-metrics">
                <div><span className="tone-blue"><Activity size={17} /></span><small>Latest BP</small><strong>{latest?.bp || "—"}</strong><em>{latest ? prettyDate(latest.takenAt) : "No observations"}</em></div>
                <div><span className="tone-teal"><HeartPulse size={17} /></span><small>Heart rate</small><strong>{latest?.hr ? `${latest.hr} bpm` : "—"}</strong><em>{latest ? `SpO₂ ${latest.spo2}%` : "Not recorded"}</em></div>
                <div><span className="tone-violet"><Pill size={17} /></span><small>Active medicines</small><strong>{activeMeds.length}</strong><em>{chart.prescriptions.length} prescriptions on file</em></div>
                <div><span className={due.length ? "tone-amber" : "tone-green"}><CreditCard size={17} /></span><small>Account</small><strong>{due.length ? `${due.length} due` : "Clear"}</strong><em>{due.length ? money(due.reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0)) : "No unpaid invoices"}</em></div>
              </div>

              <div className="record-summary-grid">
                <section className="command-panel">
                  <div className="command-panel-head"><div><span className="eyebrow">Problem list</span><h2>Active conditions</h2></div><span className="record-count">{chart.conditions.length}</span></div>
                  <div className="record-problem-list">{chart.conditions.map((condition) => <div className="record-problem-row" key={condition.id}><span className={`record-condition-dot ${condition.status}`} /><div className="grow"><b>{condition.name}</b><small>Since {condition.since} · {condition.clinician}</small></div><span className={`status ${condition.status === "active" ? "pending" : "confirmed"}`}>{condition.status}</span></div>)}{chart.conditions.length === 0 && <EmptyPlate compact scene="records" title="No conditions coded" />}</div>
                </section>

                <section className="command-panel">
                  <div className="command-panel-head"><div><span className="eyebrow">Medication profile</span><h2>Current medicines</h2></div><button className="ghost-btn" type="button" onClick={() => setTab("rx")}>Open medicines</button></div>
                  <div className="record-med-list">{activeMeds.map((med) => <div className="record-med-row" key={med.id}><span><Pill size={15} /></span><div><b>{med.name}</b><small>{med.sig}</small></div></div>)}{activeMeds.length === 0 && <EmptyPlate compact scene="pharmacy" title="No active medicines" />}</div>
                </section>
              </div>

              <section className="command-panel record-latest-panel">
                <div className="command-panel-head"><div><span className="eyebrow">Recent clinical activity</span><h2>Latest observations and results</h2></div></div>
                <div className="record-activity-grid">
                  <div className="record-vitals-snapshot"><h3>{latest ? prettyDate(latest.takenAt) : "No vitals recorded"}</h3>{latest ? <div className="record-vital-grid"><div><span>BP</span><b>{latest.bp}</b></div><div><span>HR</span><b>{latest.hr}</b></div><div><span>Temp</span><b>{latest.temp}°C</b></div><div><span>SpO₂</span><b>{latest.spo2}%</b></div></div> : <p className="muted">Clinical observations will appear here.</p>}</div>
                  <div className="record-recent-labs"><h3>Laboratory</h3>{chart.labs.slice(0, 3).map((lab) => <div key={lab.id}><span><FlaskConical size={14} /></span><div><b>{lab.name}</b><small>{lab.date} · {lab.result}</small></div><em className={lab.flag === "normal" ? "normal" : "flagged"}>{lab.flag}</em></div>)}{chart.labs.length === 0 && <p className="muted">No results on file.</p>}</div>
                </div>
              </section>
            </div>
          )}

          {tab === "vitals" && (
            <section className="record-section-card">
              <div className="record-section-head"><div><span className="eyebrow">Observations</span><h2>Vitals history</h2><p>Longitudinal measurements recorded by the clinical team.</p></div>{latest && <span className="record-latest-chip">Latest · {prettyDate(latest.takenAt)}</span>}</div>
              <div className="record-table-wrap"><table className="table"><thead><tr><th>When</th><th>BP</th><th>HR</th><th>Temp</th><th>SpO₂</th><th>Weight</th><th>Recorded by</th></tr></thead><tbody>{chart.vitals.map((row) => <tr key={row.id}><td>{prettyDate(row.takenAt)}</td><td>{row.bp}</td><td>{row.hr}</td><td>{row.temp}°C</td><td>{row.spo2}%</td><td>{row.weight || "—"}</td><td>{row.recordedBy}</td></tr>)}</tbody></table></div>
              {clinician && <form className="record-entry-form" onSubmit={saveVitals}><div className="record-entry-head"><Activity size={17} /><div><b>Record new vitals</b><small>Add a new observation set to the patient chart.</small></div></div><div className="form-grid"><label>BP<input value={vital.bp} onChange={(event) => setVital({ ...vital, bp: event.target.value })} /></label><label>Heart rate<input type="number" value={vital.hr} onChange={(event) => setVital({ ...vital, hr: event.target.value })} /></label><label>Temp °C<input type="number" step="0.1" value={vital.temp} onChange={(event) => setVital({ ...vital, temp: event.target.value })} /></label><label>SpO₂<input type="number" value={vital.spo2} onChange={(event) => setVital({ ...vital, spo2: event.target.value })} /></label><label>Weight kg<input type="number" step="0.1" value={vital.weight} onChange={(event) => setVital({ ...vital, weight: event.target.value })} /></label></div><div className="modal-actions"><button className="primary-btn"><Activity size={15} /> File observations</button></div></form>}
            </section>
          )}

          {tab === "labs" && (
            <section className="record-section-card">
              <div className="record-section-head"><div><span className="eyebrow">Diagnostics</span><h2>Laboratory results</h2><p>Results filed to this patient record.</p></div></div>
              <div className="record-lab-list">{chart.labs.map((lab) => <article className="record-lab-row" key={lab.id}><span className="record-lab-icon"><FlaskConical size={17} /></span><div className="grow"><h3>{lab.name}</h3><p>{lab.date} · {lab.result}</p></div><span className={`status ${lab.flag === "normal" ? "confirmed" : "pending"}`}>{lab.flag}</span></article>)}{chart.labs.length === 0 && <EmptyPlate scene="records" icon={FlaskConical} title="No laboratory results yet" />}</div>
            </section>
          )}

          {tab === "notes" && (
            <section className="record-section-card">
              <div className="record-section-head"><div><span className="eyebrow">Clinical documentation</span><h2>Visit notes</h2><p>Signed SOAP documentation in reverse chronological order.</p></div></div>
              <div className="record-note-timeline">{chart.notes.map((item) => <article className="record-note-card" key={item.id}><div className="record-note-marker" /><header><div><span>{item.type} · {item.date}</span><h3>{item.author}</h3></div></header><div className="soap-grid"><div><b>S</b><p>{item.subjective}</p></div><div><b>O</b><p>{item.objective}</p></div><div><b>A</b><p>{item.assessment}</p></div><div><b>P</b><p>{item.plan}</p></div></div></article>)}{chart.notes.length === 0 && <EmptyPlate scene="records" icon={FileText} title="No clinical notes filed" />}</div>
              {clinician && <form className="record-entry-form record-note-form" onSubmit={saveNote}><div className="record-entry-head"><FileText size={17} /><div><b>New SOAP note</b><small>Document the encounter and sign it to the patient chart.</small></div></div><label>Subjective<textarea rows="2" value={note.subjective} onChange={(event) => setNote({ ...note, subjective: event.target.value })} required /></label><label>Objective<textarea rows="2" value={note.objective} onChange={(event) => setNote({ ...note, objective: event.target.value })} /></label><label>Assessment<textarea rows="2" value={note.assessment} onChange={(event) => setNote({ ...note, assessment: event.target.value })} /></label><label>Plan<textarea rows="2" value={note.plan} onChange={(event) => setNote({ ...note, plan: event.target.value })} /></label><div className="modal-actions"><button className="primary-btn"><FileText size={15} /> Sign note</button></div></form>}
            </section>
          )}

          {tab === "rx" && (
            <section className="record-section-card">
              <div className="record-section-head"><div><span className="eyebrow">Medication management</span><h2>Prescriptions</h2><p>Active and historical medication orders linked to the chart.</p></div></div>
              <div className="record-rx-list">{chart.prescriptions.map((rx) => <article className="record-rx-row" key={rx.id}><span className="record-rx-icon"><Pill size={17} /></span><div className="grow"><h3>{rx.drug}</h3><p>{rx.sig} · Qty {rx.qty} · {rx.refills} refill{Number(rx.refills) === 1 ? "" : "s"} · {rx.pharmacy}</p></div><span className={`status ${rx.status}`}>{rx.status}</span><Link className="ghost-btn" to={`/prescriptions/${rx.id}`}>Open</Link>{user.role === "patient" && rx.status === "active" && <button className="secondary-btn" onClick={() => refill(rx.id)}>Request refill</button>}</article>)}{chart.prescriptions.length === 0 && <EmptyPlate scene="pharmacy" icon={Pill} title="No prescriptions on this chart" />}</div>
              {user.role === "doctor" && <div className="record-rx-pad"><RxPad patient={chart.patient} source="chart" onIssued={load} /></div>}
            </section>
          )}

          {tab === "bills" && (
            <section className="record-section-card">
              <div className="record-section-head"><div><span className="eyebrow">Patient account</span><h2>Billing linked to care</h2><p>Hospital charges and verified payment status connected to this clinical file.</p></div></div>
              <div className="record-billing-list">{chart.invoices.map((invoice) => <article className="record-billing-row" key={invoice.id}><span className="record-bill-icon"><Receipt size={17} /></span><div className="grow"><h3>{invoice.item}</h3><p>{invoice.date} · {invoice.method || "Not paid"}</p></div><strong>{money(invoice.amount, invoice.currency)}</strong><span className={`status ${invoice.status === "paid" ? "confirmed" : "pending"}`}>{invoice.status}</span>{user.role === "patient" && invoice.status === "due" && <button className="primary-btn" onClick={() => navigate(`/pay?invoice=${invoice.id}`)}>Pay now</button>}{invoice.status === "paid" && (invoice.receiptNo || invoice.paymentId) && <button className="ghost-btn" onClick={() => navigate(`/receipts/${invoice.paymentId || invoice.receiptNo}`)}>Receipt</button>}</article>)}{chart.invoices.length === 0 && <EmptyPlate scene="records" icon={Receipt} title="No invoices on this file" />}</div>
            </section>
          )}

          {tab === "intake" && (
            <section className="record-section-card">
              <div className="record-section-head"><div><span className="eyebrow">Pre-visit information</span><h2>Patient intake</h2><p>Symptoms and preparation information submitted before care.</p></div></div>
              <div className="record-intake-list">{chart.intakes.map((row) => <article className={`record-intake-card ${row.redFlags ? "red-flag" : ""}`} key={row.id}><header><span>{prettyDate(row.submittedAt)}</span>{row.redFlags && <em><AlertTriangle size={13} /> Red flags</em>}</header><h3>{row.symptoms}</h3><p>Pain {row.pain}/10 · Medicines taken: {row.medsTaken || "none stated"}</p></article>)}{chart.intakes.length === 0 && <EmptyPlate compact scene="records" icon={ClipboardList} title="No pre-visit forms submitted" />}</div>
              {user.role === "patient" && <form className="record-entry-form" onSubmit={submitIntake}><div className="record-entry-head"><ClipboardList size={17} /><div><b>Pre-visit questionnaire</b><small>Send current symptoms to the clinic before your next consultation.</small></div></div><label>How do you feel today?<textarea rows="3" value={intake.symptoms} onChange={(event) => setIntake({ ...intake, symptoms: event.target.value })} required /></label><div className="form-grid"><label>Pain 0–10<input type="number" min="0" max="10" value={intake.pain} onChange={(event) => setIntake({ ...intake, pain: event.target.value })} /></label><label>Medicines taken today<input value={intake.medsTaken} onChange={(event) => setIntake({ ...intake, medsTaken: event.target.value })} /></label></div><label className="check-row"><input type="checkbox" checked={intake.redFlags} onChange={(event) => setIntake({ ...intake, redFlags: event.target.checked })} /> Chest pain, sudden weakness, or difficulty breathing</label><div className="modal-actions"><button className="primary-btn"><ClipboardList size={15} /> Send to clinic</button></div></form>}
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
