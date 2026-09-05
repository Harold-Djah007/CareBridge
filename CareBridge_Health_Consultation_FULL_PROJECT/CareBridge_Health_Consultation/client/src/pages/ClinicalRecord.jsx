import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Pill, FlaskConical, FileText, Activity, Receipt, ClipboardList, AlertTriangle } from "lucide-react";
import { api } from "../api";
import { useAuth, useToast } from "../state";
import { prettyDate } from "../utils";
import RxPad from "../components/RxPad";
import PageHero from "../components/PageHero";

const TABS = [
  ["overview", "Overview"],
  ["vitals", "Vitals"],
  ["labs", "Labs"],
  ["notes", "Visit notes"],
  ["rx", "Medicines"],
  ["bills", "Billing"],
  ["intake", "Pre-visit"],
];

const money = (n, c = "GHS") => `${c} ${Number(n || 0).toLocaleString()}`;

export default function ClinicalRecord() {
  const { user } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();
  const { patientId: routeId } = useParams();
  const [params, setParams] = useSearchParams();
  const patientId = routeId || params.get("patient") || (user.role === "patient" ? user.id : "");
  const tab = params.get("tab") || "overview";
  const setTab = (t) => setParams((p) => { const n = new URLSearchParams(p); n.set("tab", t); return n; });

  const [chart, setChart] = useState(null);
  const [note, setNote] = useState({ subjective: "", objective: "", assessment: "", plan: "" });
  const [vital, setVital] = useState({ bp: "120/80", hr: 72, temp: 36.6, spo2: 98, weight: 70 });
  const [intake, setIntake] = useState({ symptoms: "", pain: 3, medsTaken: "", redFlags: false });

  const load = () => {
    if (!patientId) return;
    api(`/chart/${patientId}`).then(setChart).catch((e) => push(e.message, "error"));
  };
  useEffect(() => { load(); }, [patientId]);

  const clinician = user.role === "doctor" || user.role === "admin";

  const saveNote = async (e) => {
    e.preventDefault();
    await api("/notes", { method: "POST", body: JSON.stringify({ ...note, patientId, authorId: user.id }) });
    setNote({ subjective: "", objective: "", assessment: "", plan: "" });
    push("Visit note filed on the record.");
    load();
  };
  const saveVitals = async (e) => {
    e.preventDefault();
    await api("/vitals", { method: "POST", body: JSON.stringify({ ...vital, patientId, actorId: user.id, recordedBy: user.name }) });
    push("Vitals recorded.");
    load();
  };
  const refill = async (id) => {
    await api(`/prescriptions/${id}`, { method: "PATCH", body: JSON.stringify({ refillRequested: true, actorId: user.id }) });
    push("Refill requested from Ridge Campus pharmacy.");
    load();
  };
  const pay = (id) => navigate(`/pay?invoice=${id}`);
  const submitIntake = async (e) => {
    e.preventDefault();
    await api("/intakes", { method: "POST", body: JSON.stringify({ ...intake, patientId: user.id }) });
    push("Pre-visit form sent to the clinic.");
    load();
  };

  if (!patientId && clinician) {
    return (
      <div>
        <PageHero scene="records" eyebrow="Chart" title="Open a patient file" lead="Choose a person from Patients, then open their chart." />
        <button className="primary-btn" onClick={() => navigate("/care")}>Go to caseload</button>
      </div>
    );
  }
  if (!chart) return <p className="muted">Loading clinical file…</p>;
  const p = chart.patient;
  const latest = chart.vitals[0];

  return (
    <div>
      <PageHero
        scene="records"
        eyebrow={`Electronic record · ${p.mrn}`}
        title={user.role === "patient" ? "My clinical file" : p.name}
        lead={`${p.dob || "DOB —"} · Blood ${p.bloodType || "—"} · ${p.insurance || "No insurer on file"}`}
      />

      {p.allergies && p.allergies !== "None recorded" && (
        <div className="allergy-banner"><AlertTriangle size={18} /><b>Allergy:</b> {p.allergies} · Emergency {p.emergencyContact || "not listed"}</div>
      )}

      <div className="filters">
        {TABS.map(([id, label]) => (
          <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="dashboard-grid">
          <section className="card">
            <div className="card-head"><div><span className="eyebrow">Problems</span><h3>Active conditions</h3></div></div>
            {chart.conditions.map((c) => (
              <div className="appointment-row" key={c.id}>
                <div className="grow"><strong>{c.name}</strong><span className="muted">Since {c.since} · {c.clinician}</span></div>
                <span className={`status ${c.status === "active" ? "pending" : "confirmed"}`}>{c.status}</span>
              </div>
            ))}
            {chart.conditions.length === 0 && <p className="muted">No conditions coded.</p>}
            <h3 style={{ marginTop: 18 }}>Current medicines</h3>
            {chart.medications.filter((m) => m.status === "active").map((m) => (
              <div className="appointment-row" key={m.id}><div className="grow"><strong>{m.name}</strong><span className="muted">{m.sig}</span></div></div>
            ))}
          </section>
          <section className="card">
            <div className="card-head"><div><span className="eyebrow">Latest vitals</span><h3>{latest ? prettyDate(latest.takenAt) : "None yet"}</h3></div></div>
            {latest ? (
              <div className="kpi-row" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
                <div className="mini-kpi"><span>BP</span><strong>{latest.bp}</strong></div>
                <div className="mini-kpi"><span>HR</span><strong>{latest.hr}</strong></div>
                <div className="mini-kpi"><span>Temp</span><strong>{latest.temp}°C</strong></div>
                <div className="mini-kpi"><span>SpO₂</span><strong>{latest.spo2}%</strong></div>
              </div>
            ) : <p className="muted">No vitals on file.</p>}
            <p className="muted" style={{ marginTop: 14 }}>Emergency contact: {p.emergencyContact || "Add one under My details."}</p>
          </section>
        </div>
      )}

      {tab === "vitals" && (
        <section className="card">
          <table className="table">
            <thead><tr><th>When</th><th>BP</th><th>HR</th><th>Temp</th><th>SpO₂</th><th>Wt</th><th>By</th></tr></thead>
            <tbody>
              {chart.vitals.map((v) => (
                <tr key={v.id}><td>{prettyDate(v.takenAt)}</td><td>{v.bp}</td><td>{v.hr}</td><td>{v.temp}</td><td>{v.spo2}</td><td>{v.weight || "—"}</td><td>{v.recordedBy}</td></tr>
              ))}
            </tbody>
          </table>
          {clinician && (
            <form className="form-grid" style={{ marginTop: 16 }} onSubmit={saveVitals}>
              <label>BP<input value={vital.bp} onChange={(e) => setVital({ ...vital, bp: e.target.value })} /></label>
              <label>Heart rate<input type="number" value={vital.hr} onChange={(e) => setVital({ ...vital, hr: e.target.value })} /></label>
              <label>Temp °C<input type="number" step="0.1" value={vital.temp} onChange={(e) => setVital({ ...vital, temp: e.target.value })} /></label>
              <label>SpO₂<input type="number" value={vital.spo2} onChange={(e) => setVital({ ...vital, spo2: e.target.value })} /></label>
              <label>Weight kg<input type="number" step="0.1" value={vital.weight} onChange={(e) => setVital({ ...vital, weight: e.target.value })} /></label>
              <div className="modal-actions"><button className="primary-btn"><Activity size={16} /> File vitals</button></div>
            </form>
          )}
        </section>
      )}

      {tab === "labs" && (
        <section className="card">
          {chart.labs.map((l) => (
            <div className="appointment-row" key={l.id}>
              <div className="stat-icon"><FlaskConical size={16} /></div>
              <div className="grow"><strong>{l.name}</strong><span className="muted">{l.date} · {l.result}</span></div>
              <span className={`status ${l.flag === "normal" ? "confirmed" : "pending"}`}>{l.flag}</span>
            </div>
          ))}
          {chart.labs.length === 0 && <p className="muted">No laboratory results yet.</p>}
        </section>
      )}

      {tab === "notes" && (
        <div>
          {chart.notes.map((n) => (
            <section className="card" key={n.id} style={{ marginBottom: 12 }}>
              <div className="card-head"><div><span className="eyebrow">{n.type} · {n.date}</span><h3>{n.author}</h3></div></div>
              <p><b>S</b> {n.subjective}</p>
              <p><b>O</b> {n.objective}</p>
              <p><b>A</b> {n.assessment}</p>
              <p><b>P</b> {n.plan}</p>
            </section>
          ))}
          {clinician && (
            <form className="card" onSubmit={saveNote} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <h3>New SOAP note</h3>
              <label>Subjective<textarea rows="2" value={note.subjective} onChange={(e) => setNote({ ...note, subjective: e.target.value })} required /></label>
              <label>Objective<textarea rows="2" value={note.objective} onChange={(e) => setNote({ ...note, objective: e.target.value })} /></label>
              <label>Assessment<textarea rows="2" value={note.assessment} onChange={(e) => setNote({ ...note, assessment: e.target.value })} /></label>
              <label>Plan<textarea rows="2" value={note.plan} onChange={(e) => setNote({ ...note, plan: e.target.value })} /></label>
              <div className="modal-actions"><button className="primary-btn"><FileText size={16} /> Sign note</button></div>
            </form>
          )}
        </div>
      )}

      {tab === "rx" && (
        <div>
          {chart.prescriptions.map((r) => (
            <div className="appointment-row" key={r.id}>
              <div className="stat-icon"><Pill size={16} /></div>
              <div className="grow"><strong>{r.drug}</strong><span className="muted">{r.sig} · {r.qty} · {r.refills} refills · {r.pharmacy}</span></div>
              <span className={`status ${r.status}`}>{r.status}</span>
              <Link className="ghost-btn" to={`/prescriptions/${r.id}`}>Print</Link>
              {user.role === "patient" && r.status === "active" && <button className="secondary-btn" onClick={() => refill(r.id)}>Request refill</button>}
            </div>
          ))}
          {user.role === "doctor" && (
            <div className="top-gap">
              <RxPad patient={chart.patient} source="chart" onIssued={load} />
            </div>
          )}
        </div>
      )}

      {tab === "bills" && (
        <section className="card">
          {chart.invoices.map((i) => (
            <div className="appointment-row" key={i.id}>
              <div className="stat-icon"><Receipt size={16} /></div>
              <div className="grow"><strong>{i.item}</strong><span className="muted">{i.date} · {i.method}</span></div>
              <b>{money(i.amount, i.currency)}</b>
              <span className={`status ${i.status === "paid" ? "confirmed" : "pending"}`}>{i.status}</span>
              {user.role === "patient" && i.status === "due" && <button className="primary-btn" onClick={() => pay(i.id)}>Pay now</button>}
              {i.status === "paid" && (i.receiptNo || i.paymentId) && (
                <button className="ghost-btn" onClick={() => navigate(`/receipts/${i.paymentId || i.receiptNo}`)}>Receipt</button>
              )}
            </div>
          ))}
          {chart.invoices.length === 0 && <p className="muted">No invoices on this file.</p>}
        </section>
      )}

      {tab === "intake" && (
        <div>
          {chart.intakes.map((row) => (
            <div className="card" key={row.id} style={{ marginBottom: 12 }}>
              <span className="eyebrow">{prettyDate(row.submittedAt)}</span>
              <p><b>Symptoms:</b> {row.symptoms}</p>
              <p className="muted">Pain {row.pain}/10 · Meds: {row.medsTaken} · Red flags: {row.redFlags ? "yes" : "no"}</p>
            </div>
          ))}
          {user.role === "patient" && (
            <form className="card" onSubmit={submitIntake} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <h3>Pre-visit questionnaire</h3>
              <p className="muted">Complete this before a consult so the doctor is not starting from a blank page.</p>
              <label>How do you feel today?<textarea rows="3" value={intake.symptoms} onChange={(e) => setIntake({ ...intake, symptoms: e.target.value })} required /></label>
              <label>Pain 0–10<input type="number" min="0" max="10" value={intake.pain} onChange={(e) => setIntake({ ...intake, pain: e.target.value })} /></label>
              <label>Medicines taken today<input value={intake.medsTaken} onChange={(e) => setIntake({ ...intake, medsTaken: e.target.value })} /></label>
              <label className="check-row"><input type="checkbox" checked={intake.redFlags} onChange={(e) => setIntake({ ...intake, redFlags: e.target.checked })} /> Chest pain, sudden weakness, or difficulty breathing</label>
              <div className="modal-actions"><button className="primary-btn"><ClipboardList size={16} /> Send to clinic</button></div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
